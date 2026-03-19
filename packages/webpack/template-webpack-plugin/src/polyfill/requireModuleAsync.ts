// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * A runtime polyfill for `lynx.requireModuleAsync` with cache.
 * After polyfill, `lynx.requireModuleAsync()` call will be cached even if it is not finished.
 *
 * Eg.
 * ```
 * lynx.requireModuleAsync('module1', function (error, value) {
 *   console.log(error, value);
 * });
 * lynx.requireModuleAsync('module1', function (error, value) {
 *   console.log(error, value);
 * });
 * ```
 * The second `lynx.requireModuleAsync('module1')` call will reuse the first call's result. And there will be only "EvalScript" call in lynx core
 */
export function getRequireModuleAsyncCachePolyfill() {
  return `
{
  var moduleCache = {};
  var oldRequireModuleAsync = lynx.requireModuleAsync;
  lynx.requireModuleAsync = function (moduleUrl, callback) {
    var cacheEntry = moduleCache[moduleUrl];
    if (cacheEntry) {
      if (cacheEntry.status === 2)
        return callback && callback(cacheEntry.error, cacheEntry.value);
      if (cacheEntry.status === 1) {
        if (callback) cacheEntry.callbacks.push(callback);
        return;
      }
    }
    moduleCache[moduleUrl] = {
      status: 1,
      callbacks: callback ? [callback] : [],
    };
    oldRequireModuleAsync.call(lynx, moduleUrl, function (error, value) {
      var cacheEntry = moduleCache[moduleUrl];
      cacheEntry.status = 2;
      cacheEntry.error = error;
      cacheEntry.value = value;
      for (var i = 0; i < cacheEntry.callbacks.length; i++)
        cacheEntry.callbacks[i](error, value);
      cacheEntry.callbacks.length = 0;
    });
  };
  Object.assign(lynx.requireModuleAsync, oldRequireModuleAsync);
}
;`;
}
