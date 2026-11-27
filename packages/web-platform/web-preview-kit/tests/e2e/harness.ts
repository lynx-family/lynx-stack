// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type {
  EventName,
  Events,
  MethodName,
  Methods,
  ResponseMessage,
} from '../../src/protocol.js';
import { expect } from './coverage.js';
import { packageDir } from './paths.js';

declare global {
  interface Window {
    /** The helper the tests install in the kit page. */
    kit: {
      /** Every `ready` message the page posted to itself. */
      readies: unknown[];
      /** Every event that arrived on the port. */
      events: { event: EventName; data: unknown }[];
      /** Connects to the kit with `window.postMessage`. */
      connect(): void;
      /** Sends a request; resolves to its response. */
      request(method: string, params?: unknown): Promise<ResponseMessage>;
    };
  }
}

/**
 * Runs in the kit page before its own scripts (`page.addInitScript`). The kit
 * is the top-level page, so its parent is itself and `window.postMessage`
 * reaches it.
 */
function installKitHelper(): void {
  const channel = 'lynx-web-preview';
  const readies: unknown[] = [];
  const events: { event: EventName; data: unknown }[] = [];
  const pending = new Map<number, (response: ResponseMessage) => void>();
  let port: MessagePort | undefined;
  let nextId = 1;
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as { channel?: unknown; type?: unknown } | null;
    if (message?.channel === channel && message.type === 'ready') {
      readies.push(message);
    }
  });
  window.kit = {
    readies,
    events,
    connect() {
      const { port1, port2 } = new MessageChannel();
      port = port1;
      port1.onmessage = (event: MessageEvent) => {
        const message = event.data as
          | ResponseMessage
          | { event: EventName; data: unknown };
        if ('event' in message) {
          events.push(message);
        } else {
          pending.get(message.id)!(message);
          pending.delete(message.id);
        }
      };
      window.postMessage({ channel, type: 'connect' }, '*', [port2]);
    },
    request(method, params) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        port!.postMessage({ id, method, params });
      });
    },
  };
}

/**
 * Opens the kit as the top-level page. The helper is installed in every page
 * of the context, popups included.
 */
export async function loadKit(page: Page): Promise<void> {
  await page.context().addInitScript(installKitHelper);
  await page.goto('/');
}

/** The sample project in `fixtures/two-cards`. */
export async function sampleProject() {
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
    files[name] = await readFile(
      path.join(packageDir, 'fixtures/two-cards', name),
      'utf8',
    );
  }
  return {
    files,
    config: { entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' } },
  };
}

/** Drives a kit page that is connected through `window.kit`. */
export function kitApi(page: Page) {
  const all = () => page.evaluate(() => window.kit.events);
  const events = async <E extends EventName>(name: E): Promise<Events[E][]> =>
    (await all()).filter(item => item.event === name).map(item =>
      item.data as Events[E]
    );
  return {
    card: page.locator('lynx-view'),
    /** Sends a request and resolves to its response message. */
    respond(method: string, params?: unknown): Promise<ResponseMessage> {
      return page.evaluate(
        ({ method, params }) => window.kit.request(method, params),
        { method, params },
      );
    },
    /** Sends a request and resolves to its result, or throws its error. */
    async request<M extends MethodName>(
      method: M,
      params?: Methods[M]['params'],
    ): Promise<Methods[M]['result']> {
      const response = await this.respond(method, params);
      if ('error' in response) {
        throw new Error(response.error.message);
      }
      return response.result as Methods[M]['result'];
    },
    events,
    /** Waits for the first event called `name` that `match` accepts. */
    async waitForEvent<E extends EventName>(
      name: E,
      match: (data: Events[E]) => boolean = () => true,
    ): Promise<Events[E]> {
      await expect.poll(async () => (await events(name)).some(match)).toBe(
        true,
      );
      return (await events(name)).find(match)!;
    },
  };
}

export type Kit = ReturnType<typeof kitApi>;
