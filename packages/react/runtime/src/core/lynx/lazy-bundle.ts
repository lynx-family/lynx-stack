// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Inlined rather than imported from `snapshot/` so this `core/` module stays
// free of runtime-backend dependencies (enforced by
// `guardrails/snapshot-containment`). `PREPARE_LAZY_BUNDLE_MTS` must stay in
// sync with `snapshot/lifecycle/constant.ts`'s
// `LifecycleConstant.prepareLazyBundleMTS`, the lifecycle name the snapshot
// backend registers the main-thread prepare handler under.
const SECTION_MAIN_THREAD = 'main-thread';
const SECTION_BACKGROUND = 'background';
const SECTION_CSS = 'CSS';
const LYNX_LAZY_SYNC_TIMEOUT_SECONDS = 5;
const PREPARE_LAZY_BUNDLE_MTS = 'rLynxPrepareLazyBundleMTS';

// Background-thread dedup cache: a `source` whose FetchBundle load fully
// succeeded maps to its exports, so a repeat load returns the same result
// without re-fetching or re-triggering the main-thread prepare. Only populated
// on success — a failed load stays out of the cache and can be retried, exactly
// like `prepareLazyBundleMTS`'s main-thread cache.
const fetchBundleBgCache = new Map<string, unknown>();

/**
 * To make code below works
 * const App1 = lazy(() => import("./x").then(({App1}) => ({default: App1})))
 * const App2 = lazy(() => import("./x").then(({App2}) => ({default: App2})))
 * @internal
 */
export const makeSyncThen = function<T>(result: T): Promise<T>['then'] {
  return function<TR1 = T, TR2 = never>(
    this: Promise<T>,
    onF?: ((value: T) => TR1 | PromiseLike<TR1>) | null,
    _onR?: ((reason: any) => TR2 | PromiseLike<TR2>) | null,
  ): Promise<TR1 | TR2> {
    if (onF) {
      let ret: TR1 | PromiseLike<TR1>;
      try {
        ret = onF(result);
      } catch (e) {
        // if (onR) {
        //   return Promise.resolve(onR(e));
        // }
        return Promise.reject(e as Error);
      }

      if (ret && typeof (ret as PromiseLike<TR1>).then === 'function' /* `thenable` object */) {
        // lazy(() =>
        //   import("./x").then(() => new Promise(...))
        // )
        // Calling `then` and passing a callback is standard behavior
        // but in Lepus runtime the callback will never be called
        // So can be simplified to code below
        return ret as Promise<TR1>;

        // TODO(hongzhiyuan.hzy): Avoid warning that cannot be turned-off, so the warning is commented
        // lynx.reportError(
        //   new Error(
        //     'You returned a Promise in promise-chain of lazy-bundle import (eg. `import("./x").then(() => new Promise(...))`), which will cause related Component unavailable at first-screen, '
        //   ),
        //   { level: "warning" }
        // );
      }

      const p = Promise.resolve(ret);

      const then = makeSyncThen(ret as TR1);
      p.then = then as Promise<Awaited<TR1>>['then'];

      return p as Promise<TR1 | TR2>;
    }

    return this as Promise<TR1 | TR2>;
  };
};

export type LazyBundleMode = 'sync' | 'async';

// loadScript a background section with `globalThis.globDynamicComponentEntry`
// set to `entry` (restored after). The bundle's wrapper reads it once as
// `g.globDynamicComponentEntry || '__Card__'`, so without this its modules — and
// any nested `import()` it triggers — would resolve against the caller's host.
function loadBackgroundBundle<T>(bundleName: string, entry: string): T {
  const g = globalThis as { globDynamicComponentEntry?: string | undefined };
  const previous = g.globDynamicComponentEntry;
  g.globDynamicComponentEntry = entry;
  try {
    return lynx.loadScript<T>(SECTION_BACKGROUND, { bundleName });
  } finally {
    g.globDynamicComponentEntry = previous;
  }
}

/**
 * Load dynamic component from source. Designed to be used with `lazy`.
 *
 * The `mode` is threaded in by the chunk-loading runtime from the
 * `import(..., { with: { mode } })` import attribute (see `lynx_acm`), so each
 * lazy import carries its own mode instead of relying on shared mutable state.
 * @param source - where dynamic component template.js locates
 * @param mode - `'sync'` (first-screen blocking) or `'async'` (default)
 * @returns
 * @public
 */
export const loadLazyBundle: <
  T extends { default: React.ComponentType<any> },
>(source: string, mode?: LazyBundleMode, host?: string) => Promise<T> = /*#__PURE__*/ (() => {
  // Default to QueryComponent when `__LAZY_BUNDLE_FETCHER__` is missing —
  // older react-webpack-plugin builds don't stamp it and they predate
  // FetchBundle support, so falling through to QueryComponent is the only
  // safe behavior.
  const useFetchBundle = typeof __LAZY_BUNDLE_FETCHER__ !== 'undefined'
    && __LAZY_BUNDLE_FETCHER__ === 'FetchBundle';

  const impl = useFetchBundle
    ? loadLazyBundleWithFetchBundle
    : loadLazyBundleWithQueryComponent;

  if (typeof lynx !== 'undefined') {
    lynx.loadLazyBundle = impl;
  }

  function loadLazyBundleWithQueryComponent<
    T extends { default: React.ComponentType<any> },
  >(source: string, mode?: LazyBundleMode): Promise<T> {
    if (__LEPUS__) {
      const query = __QueryComponent(source);
      let result: T;
      try {
        result = query.evalResult as T;
      } catch (e) {
        // Here we cannot return a rejected promise
        // (which will eventually be an unhandled rejection and cause unnecessary redbox)
        // But we still need a object in shape of Promise
        // So we return a Promise which will never resolve or reject,
        // which fit our principle "lepus run only once at first-screen" better
        return new Promise(() => {});
      }
      const r: Promise<T> = Promise.resolve(result);
      // Why we should modify the implementation of `then`?
      // We should make it `sync` so lepus first-screen render can use result above instantly
      // We also should keep promise shape
      r.then = makeSyncThen(result);
      return r;
    } else if (typeof __JS__ === 'undefined' || __JS__) {
      if (__DEV__ && mode !== undefined) {
        throw new Error(
          `Lazy bundle import \`mode: '${mode}'\` requires FetchBundle, but the current build uses QueryComponent. `
            + `Set \`engineVersion: '3.9'\` (or higher) in \`pluginReactLynx\` to enable FetchBundle.`,
        );
      }
      const resolver = withSyncResolvers<T>();

      const callback: (result: { code: number; detail: { schema: string } }) => void = result => {
        const { code, detail } = result;
        if (code === 0) {
          const { schema } = detail;
          const exports = lynxCoreInject.tt.getDynamicComponentExports(schema);
          // `code === 0` means that the lazy bundle has been successfully parsed. However,
          // its javascript files may still fail to run, which would prevent the retrieval of the exports object.
          if (exports) {
            resolver.resolve(exports as T);
            return;
          }
        }
        const e = new Error('Lazy bundle load failed, schema: ' + result.detail.schema);
        // ES5 does not support new Error('message', { cause: 'detail' })
        // So we set cause using `.cause` assignment
        e.cause = JSON.stringify(result);
        resolver.reject(e);
      };
      if (typeof lynx.QueryComponent === 'function') {
        lynx.QueryComponent(source, callback);
      } else {
        lynx.getNativeLynx().QueryComponent!(source, callback);
      }

      if (resolver.result !== null) {
        const p = Promise.resolve(resolver.result);
        p.then = makeSyncThen(resolver.result) as Promise<Awaited<T>>['then'];
        return p;
      } else if (resolver.error === null) {
        return new Promise((_resolve, _reject) => {
          resolver.resolve = _resolve;
          resolver.reject = _reject;
        });
      } else {
        return Promise.reject(resolver.error);
      }
    }

    throw new Error('unreachable');
  }

  function loadLazyBundleWithFetchBundle<
    T extends { default: React.ComponentType<any> },
  >(source: string, mode?: LazyBundleMode, host?: string): Promise<T> {
    if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
      if (mode !== 'sync') {
        // Fire the fetch and ignore the result so the request goes out early
        // and warms the native bundle cache; the background `async` path then
        // waits less. The main thread renders nothing here.
        try {
          lynx.fetchBundle(source, { isLazyBundle: true });
        } catch {}
        return new Promise(() => {});
      }
      let response;
      try {
        response = lynx.fetchBundle(source, { isLazyBundle: true }).wait(
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
        result = lynx.loadScript<(entry: string) => T>(SECTION_MAIN_THREAD, {
          bundleName: response.url,
        })(source);
        if (
          typeof __LoadStyleSheet === 'function'
          && typeof __AdoptStyleSheet === 'function'
        ) {
          const styleSheet = __LoadStyleSheet(SECTION_CSS, response.url);
          if (styleSheet !== null) {
            __AdoptStyleSheet(styleSheet);
          }
        }
      } catch {
        return new Promise(() => {});
      }
      const r: Promise<T> = Promise.resolve(result);
      r.then = makeSyncThen(result);
      return r;
    } else if (typeof __JS__ === 'undefined' || __JS__) {
      const cached = fetchBundleBgCache.get(source);
      if (cached !== undefined) {
        const r: Promise<T> = Promise.resolve(cached as T);
        r.then = makeSyncThen(cached as T);
        return r;
      }
      if (mode === 'sync') {
        let response;
        try {
          response = lynx.fetchBundle(source, { isLazyBundle: true }).wait(
            LYNX_LAZY_SYNC_TIMEOUT_SECONDS,
          );
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        if (!response || response.code !== 0) {
          console.error('Lazy bundle load failed', response);
          const e = new Error('Lazy bundle load failed, schema: ' + source);
          e.cause = JSON.stringify(response);
          return Promise.reject(e);
        }
        let result: T;
        try {
          result = loadBackgroundBundle<T>(response.url, source);
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        // A sync bundle that wasn't part of the first-screen main-thread render
        // still needs its main-thread section prepared on the MT (the
        // createSnapshot side effect), or a later patch referencing it hits
        // "snapshot not found". Runs synchronously — the bundle is already in
        // the native cache — just like the async path below.
        try {
          lynx.getNativeApp().callLepusMethod(
            PREPARE_LAZY_BUNDLE_MTS,
            { url: source, host },
            () => {},
          );
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        // Fully loaded and prepared — cache so repeat loads skip the work above.
        fetchBundleBgCache.set(source, result);
        const r: Promise<T> = Promise.resolve(result);
        r.then = makeSyncThen(result);
        return r;
      }

      // async (default)
      return new Promise<T>((resolve, reject) => {
        let handler;
        try {
          handler = lynx.fetchBundle(source, { isLazyBundle: true });
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        handler.then((response) => {
          if (!response || response.code !== 0) {
            console.error('Lazy bundle load failed', response);
            const e = new Error('Lazy bundle load failed, schema: ' + source);
            e.cause = JSON.stringify(response);
            reject(e);
            return;
          }
          let btsResult: T;
          try {
            btsResult = loadBackgroundBundle<T>(response.url, source);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
            return;
          }
          // Bundle is now in native cache, so MT's `.then` fires sync and
          // the whole prepare runs synchronously inside `Call`, meaning the
          // cb fires only after MT snapshots are registered.
          try {
            lynx.getNativeApp().callLepusMethod(
              PREPARE_LAZY_BUNDLE_MTS,
              { url: source, host },
              () => {
                // Fully loaded and MT-prepared — cache so repeat loads skip
                // the fetch / background eval / MT prepare above.
                fetchBundleBgCache.set(source, btsResult);
                resolve(btsResult);
              },
            );
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });
      });
    }

    throw new Error('unreachable');
  }

  return impl;
})();

function withSyncResolvers<T>() {
  'background-only';

  const resolver: {
    result: T | null;
    error: Error | null;
    resolve(result: T): void;
    reject(error: Error): void;
  } = {
    resolve: (result: T): void => {
      resolver.result = result;
    },
    reject: (error: Error): void => {
      resolver.error = error;
    },
    result: null,
    error: null,
  };

  return resolver;
}
