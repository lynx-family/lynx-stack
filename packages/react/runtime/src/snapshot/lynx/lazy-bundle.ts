// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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

let lazyBundleMode: 'sync' | 'async' | undefined;

const LYNX_LAZY_SYNC_TIMEOUT_SECONDS = 5;

const SECTION_MAIN_THREAD = 'main-thread';
const SECTION_BACKGROUND = 'background';
const SECTION_CSS = 'CSS';

/**
 * Load dynamic component from source. Designed to be used with `lazy`.
 * @param source - where dynamic component template.js locates
 * @returns
 * @public
 */
export const loadLazyBundle: <
  T extends { default: React.ComponentType<any> },
>(source: string) => Promise<T> = /*#__PURE__*/ (() => {
  const useQueryComponent = typeof __LAZY_BUNDLE_FETCHER__ !== 'undefined'
    && __LAZY_BUNDLE_FETCHER__ === 'QueryComponent';

  const impl = useQueryComponent
    ? loadLazyBundleWithQueryComponent
    : loadLazyBundleWithFetchBundle;

  lynx.loadLazyBundle = impl;

  function loadLazyBundleWithQueryComponent<
    T extends { default: React.ComponentType<any> },
  >(source: string): Promise<T> {
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
    } else if (__JS__) {
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
  >(source: string): Promise<T> {
    if (__MAIN_THREAD__) {
      if (lazyBundleMode !== 'sync') {
        return new Promise(() => {});
      }
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
        result = lynx.loadScript<T>(SECTION_MAIN_THREAD, {
          bundleName: response.url,
        });
      } catch {
        return new Promise(() => {});
      }
      const styleSheet = __LoadStyleSheet(SECTION_CSS, response.url);
      if (styleSheet !== null) {
        __AdoptStyleSheet(styleSheet);
      }
      const r: Promise<T> = Promise.resolve(result);
      r.then = makeSyncThen(result);
      return r;
    } else if (__JS__) {
      if (lazyBundleMode === 'sync') {
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
          // ES5 does not support new Error('message', { cause: 'detail' })
          // So we set cause using `.cause` assignment
          e.cause = JSON.stringify(response);
          return Promise.reject(e);
        }
        let result: T;
        try {
          result = lynx.loadScript<T>(SECTION_BACKGROUND, {
            bundleName: response.url,
          });
        } catch (e) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
        const r: Promise<T> = Promise.resolve(result);
        r.then = makeSyncThen(result);
        return r;
      }

      // async (default)
      return new Promise<T>((resolve, reject) => {
        let handler;
        try {
          handler = lynx.fetchBundle(source, {});
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        handler.then((response) => {
          if (!response || response.code !== 0) {
            const e = new Error('Lazy bundle load failed, schema: ' + source);
            // ES5 does not support new Error('message', { cause: 'detail' })
            // So we set cause using `.cause` assignment
            e.cause = JSON.stringify(response);
            reject(e);
            return;
          }
          try {
            const result = lynx.loadScript<T>(SECTION_BACKGROUND, {
              bundleName: response.url,
            });
            resolve(result);
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

/**
 * Temporarily set import mode for lazy bundle.
 * @param mode Import mode.
 * @param factory Factory function.
 * @returns Result of factory function.
 */
export function withLazyBundleMode<T>(mode: 'sync' | 'async', factory: () => T): T {
  const prev = lazyBundleMode;
  lazyBundleMode = mode;
  try {
    return factory();
  } finally {
    lazyBundleMode = prev;
  }
}
