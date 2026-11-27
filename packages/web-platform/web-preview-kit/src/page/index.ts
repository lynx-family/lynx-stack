// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The entry of the kit page: the handshake with the parent window, the
 * Service Worker, and the session.
 */

import '@lynx-js/web-core/client';

import type {
  ConnectMessage,
  EventName,
  Events,
  KitMessage,
  MethodName,
  Methods,
  ReadyMessage,
  RequestMessage,
} from '../protocol.js';
import { PROTOCOL_CHANNEL } from '../protocol.js';
import { ASSET_PATH_SEGMENT } from '../shared/assets.js';
import { Session } from './session.js';

const instanceId = crypto.randomUUID();
const publicPath =
  new URL(`${ASSET_PATH_SEGMENT}/${instanceId}/`, location.href)
    .href;
const cacheName = `lynx-preview:${instanceId}`;

let port: MessagePort | undefined;

/**
 * Registers the Service Worker and waits until it controls this page, so
 * that every worker and `<lynx-view>` created afterwards is served by it.
 */
async function start(): Promise<Session> {
  const container = navigator.serviceWorker;
  await container.register(new URL('sw.js', location.href), {
    type: 'module',
  });
  if (!container.controller) {
    await new Promise((resolve) => {
      container.addEventListener('controllerchange', resolve, { once: true });
    });
  }
  return new Session({
    container: document.getElementById('preview')!,
    publicPath,
    cacheName,
    emit<E extends EventName>(event: E, data: Events[E]) {
      port!.postMessage({ event, data } as KitMessage);
    },
  });
}

// A failure is the error of every request.
const session = start();

function connect(next: MessagePort): void {
  port = next;
  let queue = Promise.resolve();
  next.onmessage = ({ data: request }: MessageEvent<RequestMessage>) => {
    // Requests are handled one after another, in the order they arrive.
    queue = queue.then(async () => {
      let response: KitMessage;
      try {
        const handler = (await session).handlers[request.method] as (
          params: unknown,
        ) => Methods[MethodName]['result'];
        response = { id: request.id, result: await handler(request.params) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        response = { id: request.id, error: { message } };
      }
      next.postMessage(response);
    });
  };
}

// Only the parent window can connect. When the kit is the top-level page, its
// parent is the page itself, so only the page's own scripts can.
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data as Partial<ConnectMessage> | null;
  if (
    !port && event.source === window.parent
    && message?.channel === PROTOCOL_CHANNEL && message.type === 'connect'
  ) {
    connect(event.ports[0]!);
  }
});

window.addEventListener('pagehide', () => {
  void caches.delete(cacheName);
});

const ready: ReadyMessage = { channel: PROTOCOL_CHANNEL, type: 'ready' };
window.parent.postMessage(ready, '*');
