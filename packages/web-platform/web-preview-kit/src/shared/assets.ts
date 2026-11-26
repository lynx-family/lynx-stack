// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * How build assets are named in CacheStorage and in URLs. The page, the
 * bundler worker and the Service Worker all follow these rules.
 */

/** The path segment, under the kit's scope, that build assets are served at. */
export const ASSET_PATH_SEGMENT = '__lynx_preview__';

/** The prefix of the CacheStorage cache of every preview instance. */
export const CACHE_NAME_PREFIX = 'lynx-preview:';

/** The cache in which the Service Worker records which client owns an instance. */
export const OWNERS_CACHE_NAME = 'lynx-preview-owners';

/** The CacheStorage cache that holds the assets of one preview instance. */
export function cacheNameOf(instanceId: string): string {
  return `${CACHE_NAME_PREFIX}${instanceId}`;
}

/**
 * The URL prefix the assets of one preview instance are served from. It ends
 * with `/`. `scope` is the Service Worker scope, which also ends with `/`.
 */
export function publicPathOf(scope: string, instanceId: string): string {
  return `${scope}${ASSET_PATH_SEGMENT}/${instanceId}/`;
}

/** Whether an asset is a hot-update file, which is pruned after a few builds. */
export function isHotUpdateAsset(name: string): boolean {
  return /\.hot-update\.[^/]+$/.test(name);
}

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  css: 'text/css; charset=utf-8',
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wasm: 'application/wasm',
};

/** The `Content-Type` an asset is served with. */
export function contentTypeOf(name: string): string {
  const extension = /\.([^./]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/**
 * Writes the assets of one build to the cache of an instance, as the
 * responses the Service Worker serves.
 */
export async function writeAssets(
  cacheName: string,
  publicPath: string,
  assets: { name: string; content: Uint8Array }[],
): Promise<void> {
  const cache = await caches.open(cacheName);
  await Promise.all(assets.map(({ name, content }) =>
    cache.put(
      new Request(new URL(name, publicPath).href),
      new Response(content as Uint8Array<ArrayBuffer>, {
        headers: {
          'Content-Type': contentTypeOf(name),
          'Content-Length': String(content.byteLength),
        },
      }),
    )
  ));
}
