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

export default function() {
  function loadUpdateChunk(chunkId, updatedModulesList) {
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
