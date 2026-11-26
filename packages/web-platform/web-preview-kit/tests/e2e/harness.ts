// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { expect } from '@playwright/test';
import type { FrameLocator, Page } from '@playwright/test';

// @ts-expect-error the serve script is plain JavaScript without types
import { startServers } from '../../scripts/serve.mjs';
import type {
  EventName,
  Events,
  MethodName,
  Methods,
} from '../../src/protocol.js';
import { staticFixtureDir } from './paths.js';

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

export function start(options: {
  kitOverrides?: Record<string, string>;
  kitRoutes?: Route[];
}): Promise<Servers> {
  return startServers({ kitPort: 0, demoPort: 0, ...options }) as Promise<
    Servers
  >;
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

export interface DemoOptions {
  /** Makes the demo cross-origin isolated. */
  isolated?: boolean;
  /** Serves the kit without `Document-Isolation-Policy`. */
  dip?: boolean;
  /** Opens the sample project at start. */
  open?: boolean;
}

/** Opens the demo host and waits for its session. */
export async function openDemo(
  page: Page,
  servers: Servers,
  options: DemoOptions = {},
) {
  const url = new URL('/index.html', servers.demoOrigin);
  url.searchParams.set('kit', `${servers.kitOrigin}/index.html`);
  url.searchParams.set('open', options.open ? '1' : '0');
  if (options.isolated) {
    url.searchParams.set('isolated', '1');
  }
  if (options.dip === false) {
    url.searchParams.set('dip', '0');
  }
  await page.goto(url.href);
  const hello = await page.evaluate(async () =>
    (await window.demo.ready).hello
  );
  return { hello, ...demoApi(page) };
}

export function demoApi(page: Page) {
  const kit: FrameLocator = page.frameLocator('#preview');
  return {
    kit,
    card: kit.locator('lynx-view'),
    async request<M extends MethodName>(
      method: M,
      params?: Methods[M]['params'],
    ): Promise<Methods[M]['result']> {
      return page.evaluate(
        async ({ method, params }) =>
          (await window.demo.ready).request(
            method as MethodName,
            params as never,
          ),
        { method, params },
      ) as Promise<Methods[M]['result']>;
    },
    /** Resolves to the error code a request fails with. */
    async requestError(method: string, params?: unknown): Promise<string> {
      return page.evaluate(async ({ method, params }) => {
        try {
          await (await window.demo.ready).request(
            method as MethodName,
            params as never,
          );
          return 'resolved';
        } catch (error) {
          return (error as { code?: string }).code ?? String(error);
        }
      }, { method, params });
    },
    async events<E extends EventName>(
      name?: E,
    ): Promise<{ event: E; data: Events[E] }[]> {
      const all = await page.evaluate(() => window.demo.events);
      return all.filter(item => !name || item.event === name) as {
        event: E;
        data: Events[E];
      }[];
    },
    /** Waits for the first event called `name` that `match` accepts. */
    async waitForEvent<E extends EventName>(
      name: E,
      match: (data: Events[E]) => boolean = () => true,
    ): Promise<Events[E]> {
      let found: Events[E] | undefined;
      await expect.poll(async () => {
        const all = await page.evaluate(() => window.demo.events);
        found = all.filter(item => item.event === name).map(item =>
          item.data as Events[E]
        ).find(match);
        return found !== undefined;
      }).toBe(true);
      return found!;
    },
    /** Waits until there are `count` events called `name`; returns them. */
    async waitForEvents<E extends EventName>(name: E, count: number) {
      await expect.poll(async () =>
        (await page.evaluate(() => window.demo.events)).filter(item =>
          item.event === name
        ).length
      ).toBeGreaterThanOrEqual(count);
      return (await page.evaluate(() => window.demo.events)).filter(item =>
        item.event === name
      ).map(item => item.data as Events[E]);
    },
  };
}
