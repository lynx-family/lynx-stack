// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Fragment, lazy as backgroundLazy, createElement } from 'preact/compat';

/**
 * To make code below works
 * const App1 = lazy(() => import("./x").then(({App1}) => ({default: App1})))
 * const App2 = lazy(() => import("./x").then(({App2}) => ({default: App2})))
 * @internal
 */
export const makeSyncThen = function<T>(result: T) {
  return function(this: Promise<T>, onF?: Function): Promise<T> {
    if (onF) {
      let ret;
      try {
        ret = onF(result);
      } catch (e) {
        return Promise.reject(e);
      }

      // @ts-ignore
      if (ret && typeof ret.then === 'function' /* `thenable` object */) {
        // lazy(() =>
        //   import("./x").then(() => new Promise(...))
        // )
        // Calling `then` and passing a callback is standard behavior
        // but in Lepus runtime the callback will never be called
        // So can be simplified to code below
        return new Promise(() => {});

        // TODO(hongzhiyuan.hzy): Avoid warning that cannot be turned-off, so the warning is commented
        // lynx.reportError(
        //   new Error(
        //     'You returned a Promise in promise-chain of lazy-bundle import (eg. `import("./x").then(() => new Promise(...))`), which will cause related Component unavailable at first-screen, '
        //   ),
        //   { level: "warning" }
        // );
      }

      const p = Promise.resolve(ret);
      // @ts-ignore
      p.then = makeSyncThen(ret);
      return p;
    }

    return this;
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
        result = query.evalResult;
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
      // @ts-ignore
      r.then = makeSyncThen(result);
      return r;
    } else if (__JS__) {
      return new Promise((resolve, reject) => {
        const callback: (result: any) => void = result => {
          const { code, detail } = result;
          if (code === 0) {
            const { schema } = detail;
            const exports = lynxCoreInject.tt.getDynamicComponentExports(schema);
            // `code === 0` means that the lazy bundle has been successfully parsed. However,
            // its javascript files may still fail to run, which would prevent the retrieval of the exports object.
            if (exports) {
              resolve(exports);
              return;
            }
          }
          reject(new Error('Lazy bundle load failed: ' + JSON.stringify(result)));
        };
        if (typeof lynx.QueryComponent === 'function') {
          lynx.QueryComponent(source, callback);
        } else {
          lynx.getNativeLynx().QueryComponent!(source, callback);
        }
      });
    }

    throw new Error('unreachable');
  }

  return loadLazyBundle;
})();

/**
 * @internal
 */
export function mainThreadLazy<T>(loader: () => Promise<{ default: T } | T>) {
  const Lazy = backgroundLazy<T>(loader);

  function _Lazy(props: any) {
    try {
      // @ts-expect-error `Lazy` returned from `backgroundLazy` should be a FC
      return Lazy(props);
    } catch (e) {
      // We should never throw at mainThread
      return createElement(Fragment, {});
    }
  }

  return _Lazy as T;
}
