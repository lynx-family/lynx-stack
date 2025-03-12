/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
// @ts-nocheck

export default function() {
  function loadUpdateChunk(chunkId, updatedModulesList) {
    if (globalThis.__QueryComponent) {
      return new Promise((resolve, reject) => {
        globalThis.__QueryComponent(
          $RuntimeGlobals_publicPath$
            + $RuntimeGlobals_getChunkUpdateScriptFilename$(chunkId)
            + '.template.js',
          (ret) => {
            const {
              code,
              data,
            } = ret;

            if (code === 0) {
              const evalResult = data.evalResult;

              if (typeof evalResult === 'function') {
                const update = evalResult();

                var updatedModules = update.modules;
                var runtime = update.runtime;
                for (var moduleId in updatedModules) {
                  if (
                    $RuntimeGlobals_hasOwnProperty$(updatedModules, moduleId)
                  ) {
                    currentUpdate[moduleId] = updatedModules[moduleId];
                    if (updatedModulesList) updatedModulesList.push(moduleId);
                  }
                }
                if (runtime) currentUpdateRuntime.push(runtime);
                resolve();
              } else {
                reject(
                  new Error(
                    'Failed to get mainThread exports. evalResult is not a function.',
                  ),
                );
              }
            }
            reject(
              new Error(
                'Failed to get mainThread exports. ret: ' + JSON.stringify(ret),
              ),
            );
          },
        );
      });
    }
    return new Promise((resolve, reject) => {
      lynx.requireModuleAsync(
        $RuntimeGlobals_publicPath$
          + $RuntimeGlobals_getChunkUpdateScriptFilename$(chunkId),
        (err, update) => {
          if (err) {
            reject(err);
            return;
          }

          var updatedModules = update.modules;
          var runtime = update.runtime;
          for (var moduleId in updatedModules) {
            if ($RuntimeGlobals_hasOwnProperty$(updatedModules, moduleId)) {
              currentUpdate[moduleId] = updatedModules[moduleId];
              if (updatedModulesList) updatedModulesList.push(moduleId);
            }
          }
          if (runtime) currentUpdateRuntime.push(runtime);
          resolve();
        },
      );
    });
  }
}
