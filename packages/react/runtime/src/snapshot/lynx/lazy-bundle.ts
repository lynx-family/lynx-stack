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
