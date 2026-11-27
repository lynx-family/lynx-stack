// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import type { FrameLocator, Locator, Page } from '@playwright/test';

// @ts-expect-error the serve script is plain JavaScript without types
import { startServers } from '../../scripts/serve.mjs';
import type {
  EventName,
  Events,
  HelloInfo,
  MethodName,
  Methods,
  ResponseMessage,
} from '../../src/protocol.js';
import {
  expect,
  serveForCoverage,
  stopServingForCoverage,
} from './coverage.js';
import { packageDir, staticFixtureDir } from './paths.js';

export type Route = (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) => boolean | Promise<boolean>;

export interface Servers {
  kitOrigin: string;
  demoOrigin: string;
  close(): Promise<void>;
}

/**
 * Starts the kit and demo servers of `scripts/serve.mjs` on free ports.
 * `kitOverrides` serves other files at some URL paths of the kit, for
 * example a test double at `/bundler-worker.js`.
 */
export async function start(options: {
  kitOverrides?: Record<string, string>;
  kitRoutes?: Route[];
}): Promise<Servers> {
  const servers = await startServers({
    kitPort: 0,
    demoPort: 0,
    ...options,
  }) as Servers;
  const overrides = options.kitOverrides ?? {};
  const fileIn = (root: string) => (pathname: string) =>
    path.join(
      root,
      decodeURIComponent(pathname === '/' ? '/index.html' : pathname),
    );
  serveForCoverage(
    servers.kitOrigin,
    pathname =>
      overrides[pathname]
        ?? fileIn(path.join(packageDir, 'dist/kit'))(pathname),
  );
  serveForCoverage(
    servers.demoOrigin,
    fileIn(path.join(packageDir, 'dist/demo')),
  );
  return {
    ...servers,
    async close() {
      stopServingForCoverage(servers.kitOrigin);
      stopServingForCoverage(servers.demoOrigin);
      await servers.close();
    },
  };
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      result.push(...await listFiles(path.join(dir, entry.name), `${name}/`));
    } else {
      result.push(name);
    }
  }
  return result;
}

/** Serves the prebuilt fixture under `/__fixture__/` on the kit origin. */
export const staticFixtureRoute: Route = async (_request, response, url) => {
  if (!url.pathname.startsWith('/__fixture__/')) {
    return false;
  }
  const name = decodeURIComponent(url.pathname.slice('/__fixture__/'.length));
  const headers = {
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (name === 'manifest.json') {
    const files = (await listFiles(staticFixtureDir)).filter(file =>
      !file.startsWith('.lynx/')
    );
    response.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
      .end(JSON.stringify(files));
    return true;
  }
  const content = await readFile(path.join(staticFixtureDir, name)).catch(
    () => undefined,
  );
  if (!content || name.includes('..')) {
    response.writeHead(404, headers).end();
    return true;
  }
  response.writeHead(200, headers).end(content);
  return true;
};

/** The sample project of the demo, `demo/sample.ts`, read from the fixture. */
export async function sampleProject() {
  const fixture = path.join(packageDir, 'fixtures/two-cards');
  const names = [
    'src/main.tsx',
    'src/MainCard.tsx',
    'src/main.css',
    'src/greeting.ts',
    'src/detail.tsx',
    'src/detail.css',
  ];
  const files: Record<string, string> = {};
  for (const name of names) {
    files[name] = await readFile(path.join(fixture, name), 'utf8');
  }
  return {
    files,
    config: {
      entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' },
    } as { entries: Record<string, string> },
  };
}

// ---------------------------------------------------------------------------
// The kit as the top-level page.
// ---------------------------------------------------------------------------

/**
 * Runs in the kit page before its own scripts (`page.addInitScript`). It
 * connects as soon as the kit announces itself, as a host would, and records
 * what arrives on the port in `window.kit`. The kit is the top-level page,
 * so its parent is itself and `window.postMessage` reaches it.
 */
function installKitHelper(): void {
  if (window !== window.top) {
    return;
  }
  const channel = 'lynx-web-preview';
  const events: { event: string; data: unknown }[] = [];
  const responses: unknown[] = [];
  const readies: unknown[] = [];
  const pending = new Map<number, (response: unknown) => void>();
  let port: MessagePort | undefined;
  let nextId = 1;
  let firstHello!: (hello: unknown) => void;
  const ready = new Promise((resolve) => {
    firstHello = resolve;
  });

  function connect(): Promise<unknown> {
    const { port1, port2 } = new MessageChannel();
    port = port1;
    return new Promise((resolve) => {
      port1.onmessage = (event: MessageEvent) => {
        const message = event.data as
          | { event?: unknown; data?: unknown; id?: unknown }
          | null;
        if (typeof message?.event === 'string') {
          if (message.event === 'hello') {
            resolve(message.data);
          }
          events.push(message as { event: string; data: unknown });
          return;
        }
        responses.push(message);
        const callback = pending.get(message?.id as number);
        if (callback) {
          pending.delete(message!.id as number);
          callback(message);
        }
      };
      window.postMessage({ channel, type: 'connect', version: 1 }, '*', [
        port2,
      ]);
    });
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as { channel?: unknown; type?: unknown } | null;
    if (
      event.source !== window || message?.channel !== channel
      || message.type !== 'ready'
    ) {
      return;
    }
    readies.push(message);
    if (readies.length === 1) {
      void connect().then(firstHello);
    }
  });

  window.kit = {
    ready: ready as Promise<never>,
    events: events as never,
    responses,
    readies,
    connect: connect as () => Promise<never>,
    request(method, params) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve as (response: unknown) => void);
        port!.postMessage({ id, method, params });
      });
    },
    send(message) {
      port!.postMessage(message);
    },
  };
}

export interface KitOptions {
  /** Serves the kit without `Document-Isolation-Policy`. */
  dip?: boolean;
}

const helped = new WeakSet<Page>();

/**
 * Opens the kit as the top-level page and waits for its session. The helper
 * stays installed for later navigations of the page.
 */
export async function openKit(
  page: Page,
  servers: Servers,
  options: KitOptions = {},
) {
  if (!helped.has(page)) {
    helped.add(page);
    await page.addInitScript(installKitHelper);
  }
  const url = new URL('/index.html', servers.kitOrigin);
  if (options.dip === false) {
    url.searchParams.set('dip', '0');
  }
  await page.goto(url.href);
  const hello = await page.evaluate(() => window.kit.ready);
  return { hello, ...kitApi(page) };
}

export type Kit = Awaited<ReturnType<typeof openKit>>;

/** An error response, as the error of a rejected request. */
export class RequestFailed extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

/** Drives the kit page through `window.kit`. */
export function kitApi(page: Page) {
  const allEvents = () => page.evaluate(() => window.kit.events);
  /** Sends a request and resolves to its response message. */
  const respond = <M extends MethodName>(
    method: M | string,
    params?: unknown,
  ): Promise<ResponseMessage<M>> =>
    page.evaluate(
      ({ method, params }) => window.kit.request(method, params),
      { method, params },
    ) as Promise<ResponseMessage<M>>;
  return {
    page,
    card: page.locator('lynx-view') as Locator,
    respond,
    async request<M extends MethodName>(
      method: M,
      params?: Methods[M]['params'],
    ): Promise<Methods[M]['result']> {
      const response = await respond<M>(method, params);
      if ('error' in response) {
        throw new RequestFailed(response.error.code, response.error.message);
      }
      return response.result;
    },
    /** Resolves to the error code a request fails with, or `resolved`. */
    async requestError(method: string, params?: unknown): Promise<string> {
      const response = await respond(method, params);
      return 'error' in response ? response.error.code : 'resolved';
    },
    events: eventsOf(allEvents),
    ...waiters(allEvents),
  };
}

type EventList = { event: EventName; data: unknown }[];

function eventsOf(all: () => Promise<EventList>) {
  return async <E extends EventName>(
    name?: E,
  ): Promise<{ event: E; data: Events[E] }[]> =>
    (await all()).filter(item => !name || item.event === name) as {
      event: E;
      data: Events[E];
    }[];
}

function waiters(all: () => Promise<EventList>) {
  return {
    /** Waits for the first event called `name` that `match` accepts. */
    async waitForEvent<E extends EventName>(
      name: E,
      match: (data: Events[E]) => boolean = () => true,
    ): Promise<Events[E]> {
      let found: Events[E] | undefined;
      await expect.poll(async () => {
        found = (await all()).filter(item => item.event === name).map(item =>
          item.data as Events[E]
        ).find(match);
        return found !== undefined;
      }).toBe(true);
      return found!;
    },
    /** Waits until there are `count` events called `name`; returns them. */
    async waitForEvents<E extends EventName>(
      name: E,
      count: number,
    ): Promise<Events[E][]> {
      await expect.poll(async () =>
        (await all()).filter(item => item.event === name).length
      ).toBeGreaterThanOrEqual(count);
      return (await all()).filter(item => item.event === name).map(item =>
        item.data as Events[E]
      );
    },
  };
}

// ---------------------------------------------------------------------------
// The demo host, which embeds the kit in an iframe and uses `src/client`.
// ---------------------------------------------------------------------------

export interface DemoOptions {
  /** Makes the demo cross-origin isolated. */
  isolated?: boolean;
  /** Serves the kit without `Document-Isolation-Policy`. */
  dip?: boolean;
}

/** Opens the demo host, without the sample project, and waits for its session. */
export async function openDemo(
  page: Page,
  servers: Servers,
  options: DemoOptions = {},
) {
  const url = new URL('/index.html', servers.demoOrigin);
  url.searchParams.set('kit', `${servers.kitOrigin}/index.html`);
  url.searchParams.set('open', '0');
  if (options.isolated) {
    url.searchParams.set('isolated', '1');
  }
  if (options.dip === false) {
    url.searchParams.set('dip', '0');
  }
  await page.goto(url.href);
  const hello: HelloInfo = await page.evaluate(async () =>
    (await window.demo.ready).hello
  );
  const kit: FrameLocator = page.frameLocator('#preview');
  const allEvents = () => page.evaluate(() => window.demo.events);
  return {
    hello,
    kit,
    card: kit.locator('lynx-view'),
    events: eventsOf(allEvents),
    ...waiters(allEvents),
  };
}
