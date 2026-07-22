/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
// @ts-nocheck
// The function below is stringified into build output via
// `Template.getFunctionContent` - instrumentation would inject undefined
// `cov_*` references into the generated bundle.
/* istanbul ignore file */

var $JS_MATCHER$ = undefined;

export default function() {
  // TODO: replace this with `withLoading`
  if ($RuntimeGlobals_ensureChunkHandlers$) {
    // require() chunk loading for javascript
    $RuntimeGlobals_ensureChunkHandlers$.require = function(chunkId, promises) {
      var installedChunkData = installedChunks[chunkId];
      // "1" is the signal for "already loaded"
      if (installedChunkData !== 1) {
        if (installedChunkData) {
          // array of [resolve, reject, promise] means "currently loading"
          promises.push(installedChunkData[2]);
        } else {
          if ($JS_MATCHER$) {
            if (
              $RuntimeGlobals_lynxAsyncChunkIds$
              && $RuntimeGlobals_lynxAsyncChunkIds$[chunkId]
            ) {
              installedChunkData = installedChunks[chunkId] = [null, null];
              const promise = lynx.loadLazyBundle(
                $RuntimeGlobals_publicPath$
                  + $RuntimeGlobals_lynxAsyncChunkIds$[chunkId],
                // `lynx_acm` may be absent (e.g. a build that emits `lynx_aci`
                // without the mode map); the loader treats a missing mode as
                // `async`.
                $RuntimeGlobals_lynxAsyncChunkMode$
                  && $RuntimeGlobals_lynxAsyncChunkMode$[chunkId],
                // The loading host's own entry, so the MT prepare routes this
                // chunk's eval result to the host that owns its modules.
                typeof globDynamicComponentEntry !== 'undefined'
                  ? globDynamicComponentEntry
                  : undefined,
              ).then((exports) => {
                installChunk(exports);
                return exports;
              });
              installedChunkData[2] = promise;
              promises.push(promise);
              return;
            }

            const promise = new Promise((resolve, reject) => {
              installedChunkData = installedChunks[chunkId] = [resolve, reject];
              lynx.requireModuleAsync(
                $RuntimeGlobals_publicPath$
                  + $RuntimeGlobals_getChunkScriptFilename$(chunkId),
                (err, exports) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  installChunk(exports);
                  resolve(exports);
                },
              );
            });
            installedChunkData[2] = promise;
            promises.push(promise);
          } else {
            installedChunks[chunkId] = 1;
          }
        }
      }
    };

    $RuntimeGlobals_ensureChunk$ = function(chunkId) {
      var promises = Object.keys($RuntimeGlobals_ensureChunkHandlers$).reduce(
        function(promises, key) {
          $RuntimeGlobals_ensureChunkHandlers$[key](chunkId, promises);
          return promises;
        },
        [],
      );
      // Skip the Promise.all wrap for the common one-chunk case so a
      // sync-resolved loader (e.g. cached lazy bundle) keeps its sync `.then`
      // and preact's `lazy()` can resolve at first render. webpack callers
      // (`__webpack_require__.bind(__webpack_require__, moduleId)`) ignore the
      // resolved value, so returning a single value instead of `[value]` is safe.
      if (promises.length === 1) return promises[0];
      return Promise.all(promises);
    };
  }
  if (typeof installChunk !== 'undefined') {
    $RuntimeGlobals_externalInstallChunk$ = installChunk;
  }
}
