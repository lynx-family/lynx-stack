// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { makeSyncThen } from '../../core/lynx/lazy-bundle.js';

// Element Template lazy bundles are fetched via `lynx.fetchBundle` and each
// section is run via `lynx.loadScript`. ET template definitions are compiled
// into the bundle's `tasm.json`, so native materializes the templates (by
// content-hashed `templateKey`) from the fetched Lynx.bundle — the main thread
// only needs the `main-thread` section for `sync` first-screen direct render
// (to produce the first-screen elements); `async` is background-driven.
const SECTION_MAIN_THREAD = 'main-thread';
const SECTION_BACKGROUND = 'background';

// `mode: 'sync'` blocks first-screen on the fetch; `wait()` needs a timeout.
const LYNX_LAZY_SYNC_TIMEOUT_SECONDS = 5;

export type LazyBundleMode = 'sync' | 'async';

/**
 * Load an Element Template lazy bundle via `lynx.fetchBundle`. Designed to be
 * used with `lazy`. The `mode` is threaded in by the chunk-loading runtime from
 * the `import(..., { with: { mode } })` import attribute (see `lynx_acm`).
 * @param source - where the lazy bundle Lynx.bundle locates
 * @param mode - `'sync'` (first-screen blocking) or `'async'` (default)
 * @public
 */
export const loadLazyBundle: <
  T extends { default: React.ComponentType<any> },
>(source: string, mode?: LazyBundleMode) => Promise<T> = /*#__PURE__*/ (() => {
  lynx.loadLazyBundle = loadLazyBundle;

  function loadLazyBundle<
    T extends { default: React.ComponentType<any> },
  >(source: string, mode?: LazyBundleMode): Promise<T> {
    if (__MAIN_THREAD__) {
      // `async`: the lazy subtree is rendered on the background thread and
      // materialized on the main thread from native templates, so the main
      // thread renders nothing here — but we still fire the fetch (ignoring
      // the result) to warm the native bundle cache so the background `async`
      // path waits less.
      if (mode !== 'sync') {
        try {
          lynx.fetchBundle(source, {});
        } catch {}
        return new Promise(() => {});
      }
      // `sync` (first-screen direct render): the main thread must run the lazy
      // bundle's `main-thread` section to produce the first-screen elements.
      let response;
      try {
        response = lynx.fetchBundle(source, {}).wait(
          LYNX_LAZY_SYNC_TIMEOUT_SECONDS,
        );
      } catch {
        return new Promise(() => {});
      }
      if (!response || response.code !== 0) {
        return new Promise(() => {});
      }
      let result: T;
      try {
        const oldGlobalDynamicComponentEntry = globalThis.globDynamicComponentEntry;
        globalThis.globDynamicComponentEntry = response.url;
        result = lynx.loadScript<T>(SECTION_MAIN_THREAD, {
          bundleName: response.url,
        });
        globalThis.globDynamicComponentEntry = oldGlobalDynamicComponentEntry;
      } catch {
        return new Promise(() => {});
      }
      const r: Promise<T> = Promise.resolve(result);
      r.then = makeSyncThen(result);
      return r;
    } else if (__JS__) {
      if (mode === 'sync') {
        let response;
        try {
          response = lynx.fetchBundle(source, {}).wait(
            LYNX_LAZY_SYNC_TIMEOUT_SECONDS,
          );
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        if (!response || response.code !== 0) {
          const e = new Error('Lazy bundle load failed, schema: ' + source);
          e.cause = JSON.stringify(response);
          return Promise.reject(e);
        }
        let result: T;
        try {
          const oldGlobalDynamicComponentEntry = globalThis.globDynamicComponentEntry;
          globalThis.globDynamicComponentEntry = response.url;
          result = lynx.loadScript<T>(SECTION_BACKGROUND, {
            bundleName: response.url,
          });
          globalThis.globDynamicComponentEntry = oldGlobalDynamicComponentEntry;
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        const r: Promise<T> = Promise.resolve(result);
        r.then = makeSyncThen(result);
        return r;
      }

      // async (default)
      return new Promise<T>((resolve, reject) => {
        // The upstream `ResponseHandler.then` type is a placeholder stub; it is
        // a callback at runtime, so type it locally.
        let handler: {
          then(onResolve: (response: { code: number; url: string }) => void): void;
        };
        try {
          handler = lynx.fetchBundle(source, {}) as unknown as typeof handler;
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        handler.then((response) => {
          if (!response || response.code !== 0) {
            const e = new Error('Lazy bundle load failed, schema: ' + source);
            e.cause = JSON.stringify(response);
            reject(e);
            return;
          }
          let result: T;
          try {
            const oldGlobalDynamicComponentEntry = globalThis.globDynamicComponentEntry;
            globalThis.globDynamicComponentEntry = response.url;
            result = lynx.loadScript<T>(SECTION_BACKGROUND, {
              bundleName: response.url,
            });
            globalThis.globDynamicComponentEntry = oldGlobalDynamicComponentEntry;
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
            return;
          }
          // No `processEvalResult` round-trip is needed (unlike the
          // QueryComponent path): once `fetchBundle` resolves, the native cache
          // holds the bundle, so any `__CreateElementTemplate` patch the
          // background thread emits next resolves its template on the main thread.
          resolve(result);
        });
      });
    }

    throw new Error('unreachable');
  }

  return loadLazyBundle;
})();
