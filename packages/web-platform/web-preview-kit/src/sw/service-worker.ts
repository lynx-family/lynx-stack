// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The Service Worker of the kit. It serves
 * `<scope>/__lynx_preview__/<instanceId>/<asset>` from the CacheStorage cache
 * of that preview instance, ignoring the query string, and removes the caches
 * of instances whose page has gone.
 */

import {
  ASSET_PATH_SEGMENT,
  CACHE_NAME_PREFIX,
  OWNERS_CACHE_NAME,
  cacheNameOf,
} from '../shared/assets.js';
import type { ServiceWorkerMessage } from '../shared/sw-messages.js';

const sw = self as unknown as ServiceWorkerGlobalScope;

const scopePath = new URL(sw.registration.scope).pathname;
const assetPrefix = `${scopePath}${ASSET_PATH_SEGMENT}/`;

function ownerKey(instanceId: string): string {
  return new URL(`${assetPrefix}${instanceId}`, sw.location.origin).href;
}

/** Deletes the caches of instances whose owning page is gone. */
async function pruneStaleCaches(): Promise<void> {
  const owners = await caches.open(OWNERS_CACHE_NAME);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(name => name.startsWith(CACHE_NAME_PREFIX))
      .map(async (name) => {
        const instanceId = name.slice(CACHE_NAME_PREFIX.length);
        const owner = await owners.match(ownerKey(instanceId));
        const clientId = owner ? await owner.text() : undefined;
        const client = clientId ? await sw.clients.get(clientId) : undefined;
        if (!client) {
          await caches.delete(name);
          await owners.delete(ownerKey(instanceId));
        }
      }),
  );
}

sw.addEventListener('install', () => {
  void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    sw.clients.claim().then(pruneStaleCaches),
  );
});

sw.addEventListener('message', (event) => {
  const message = event.data as ServiceWorkerMessage | undefined;
  const source = event.source;
  if (message?.type !== 'claim' || !(source instanceof Client)) {
    return;
  }
  event.waitUntil(
    (async () => {
      const owners = await caches.open(OWNERS_CACHE_NAME);
      await owners.put(
        ownerKey(message.instanceId),
        new Response(source.id),
      );
      await pruneStaleCaches();
      event.ports[0]?.postMessage({ type: 'claimed' });
    })(),
  );
});

const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });

async function serve(url: URL): Promise<Response> {
  const rest = url.pathname.slice(assetPrefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) {
    return notFound();
  }
  const instanceId = decodeURIComponent(rest.slice(0, slash));
  if (!(await caches.has(cacheNameOf(instanceId)))) {
    return notFound();
  }
  const cache = await caches.open(cacheNameOf(instanceId));
  const stored = await cache.match(url.origin + url.pathname);
  if (!stored) {
    return notFound();
  }
  const headers = new Headers(stored.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(stored.body, { status: 200, headers });
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== sw.location.origin || !url.pathname.startsWith(assetPrefix)
  ) {
    return;
  }
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
    return;
  }
  event.respondWith(serve(url));
});
