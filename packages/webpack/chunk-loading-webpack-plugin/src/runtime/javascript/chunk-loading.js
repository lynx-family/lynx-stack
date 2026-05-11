/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
// @ts-nocheck

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
      if (promises.length === 1) return promises[0];
      return Promise.all(promises);
    };
  }
  if (typeof installChunk !== 'undefined') {
    $RuntimeGlobals_externalInstallChunk$ = installChunk;
  }
}
