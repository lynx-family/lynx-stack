// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isHotUpdateAsset } from '../shared/assets.js';

/** The page's access to the assets of its preview instance. */
export interface AssetStore {
  /** Removes every asset. */
  clear(): Promise<void>;
  /** Reads an asset, or `undefined` when it is not stored. */
  read(name: string): Promise<Uint8Array | undefined>;
  /**
   * Records the assets of a finished build and removes the hot-update files
   * that none of the last few builds lists.
   */
  prune(assetNames: string[]): Promise<void>;
  /**
   * Copies the card bundles of a successful build, so that later builds,
   * failed ones included, cannot change what a card loads. Resolves to the
   * URL prefix of the copies.
   */
  snapshot(key: string, bundles: string[]): Promise<string>;
}

/** How many builds keep their hot-update files. */
export const KEPT_BUILDS = 5;

/** How many snapshots of card bundles are kept. */
export const KEPT_SNAPSHOTS = 2;

/** Where the snapshots of card bundles are, under the public path. */
export const SNAPSHOT_DIR = '.cards/';

/** An {@link AssetStore} over the CacheStorage cache of the instance. */
export class CacheAssetStore implements AssetStore {
  readonly #cacheName: string;
  readonly #publicPath: string;
  #recent: string[][] = [];
  #snapshots: string[] = [];

  constructor(cacheName: string, publicPath: string) {
    this.#cacheName = cacheName;
    this.#publicPath = publicPath;
  }

  async clear(): Promise<void> {
    this.#recent = [];
    this.#snapshots = [];
    await caches.delete(this.#cacheName);
  }

  async read(name: string): Promise<Uint8Array | undefined> {
    const cache = await caches.open(this.#cacheName);
    const response = await cache.match(new URL(name, this.#publicPath).href);
    return response
      ? new Uint8Array(await response.arrayBuffer())
      : undefined;
  }

  async prune(assetNames: string[]): Promise<void> {
    this.#recent.push(assetNames.filter(isHotUpdateAsset));
    if (this.#recent.length > KEPT_BUILDS) {
      this.#recent.shift();
    }
    const kept = new Set(
      this.#recent.flat().map(name => new URL(name, this.#publicPath).href),
    );
    const cache = await caches.open(this.#cacheName);
    for (const request of await cache.keys()) {
      const name = request.url.slice(this.#publicPath.length);
      if (isHotUpdateAsset(name) && !kept.has(request.url)) {
        await cache.delete(request);
      }
    }
  }

  async snapshot(key: string, bundles: string[]): Promise<string> {
    const prefix = new URL(
      `${SNAPSHOT_DIR}${encodeURIComponent(key)}/`,
      this.#publicPath,
    ).href;
    const cache = await caches.open(this.#cacheName);
    for (const bundle of bundles) {
      const response = await cache.match(
        new URL(bundle, this.#publicPath).href,
      );
      if (response) {
        await cache.put(new URL(bundle, prefix).href, response);
      }
    }
    this.#snapshots.push(prefix);
    while (this.#snapshots.length > KEPT_SNAPSHOTS) {
      const old = this.#snapshots.shift()!;
      for (const request of await cache.keys()) {
        if (request.url.startsWith(old)) {
          await cache.delete(request);
        }
      }
    }
    return prefix;
  }
}
