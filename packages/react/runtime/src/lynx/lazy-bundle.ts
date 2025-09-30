// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect } from 'preact/hooks';

/**
 * @public
 */
export interface LazyBundleResponse {
  code: 0 | 1601 | 1602 | 1603;
  detail: {
    schema: string;
    cache: boolean;
    errMsg: string;
  };
  /** Detail info when loading failed */
  data?: any;
}
/**
 * @public
 */
export type OnLazyBundleResponse = (response: LazyBundleResponse) => void;

/**
 * @public
 */
export interface GlobalLazyBundleResponseListenerProps {
  /**
   * @public
   */
  onResponse: OnLazyBundleResponse;
}

let onResponse: OnLazyBundleResponse | null = null;
let globalLazyBundleResponseListenerMounted = false;

/**
 * Lets you listen on response of loading a lazy bundle.
 *
 * @see {@link https://lynxjs.org/react/code-splitting#code-splitting}
 *
 * @param onResponse - A function that will be called when a lazy bundle response is received.
 *
 * @example
 *
 * ```tsx
 * import { GlobalLazyBundleResponseListener } from '@lynx-js/react';
 *
 * root.render(
 *  <>
 *    <App />
 *    <GlobalLazyBundleResponseListener
 *      onResponse={(response) => {
 *        console.log("response", response);
 *      }}
 *    />
 *  </>
 * )
 * ```
 *
 * @public
 */
export function GlobalLazyBundleResponseListener({ onResponse: _onResponse }: GlobalLazyBundleResponseListenerProps) {
  useEffect(() => {
    if (globalLazyBundleResponseListenerMounted) {
      throw new Error('<GlobalLazyBundleResponseListener /> can only be used once in the whole page');
    }
    globalLazyBundleResponseListenerMounted = true;

    return () => {
      globalLazyBundleResponseListenerMounted = false;
    };
  }, []);

  useEffect(() => {
    onResponse = _onResponse;
    return () => onResponse = null;
  }, [_onResponse]);

  return null;
}

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

/**
 * Load dynamic component from source. Designed to be used with `lazy`.
 * @param source - where dynamic component template.js locates
 * @returns
 * @public
 */
export const loadLazyBundle: <
  T extends { default: React.ComponentType<any> },
>(source: string) => Promise<T> = /*#__PURE__*/ (() => {
  lynx.loadLazyBundle = loadLazyBundle;

  function loadLazyBundle<
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

      const callback: (result: LazyBundleResponse) => void = result => {
        onResponse?.(result);
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
        resolver.reject(new Error('Lazy bundle load failed: ' + JSON.stringify(result)));
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

  return loadLazyBundle;
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
