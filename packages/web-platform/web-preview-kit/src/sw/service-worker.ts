// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The Service Worker of the kit. It serves the build assets that the bundler
 * worker writes to CacheStorage, ignoring the query string. The instance id
 * in their URLs keeps the previews of several pages apart.
 */

import { ASSET_PATH_SEGMENT } from '../shared/assets.js';

const sw = self as unknown as ServiceWorkerGlobalScope;

const assetPrefix = `${sw.registration.scope}${ASSET_PATH_SEGMENT}/`;

sw.addEventListener('install', () => {
  void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.href.startsWith(assetPrefix)) {
    return;
  }
  event.respondWith(
    caches.match(url.origin + url.pathname).then(response =>
      response ?? new Response('Not found', { status: 404 })
    ),
  );
});
