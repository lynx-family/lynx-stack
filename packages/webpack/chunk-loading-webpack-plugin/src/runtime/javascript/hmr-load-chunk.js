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
    var load = __webpack_require__.lynxHMRLoad
      || lynx.requireModuleAsync.bind(lynx);
    return new Promise((resolve, reject) => {
      load(
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
              if (
                updatedModulesList
                && !$RuntimeGlobals_hasOwnProperty$(currentUpdate, moduleId)
              ) updatedModulesList.push(moduleId);
              currentUpdate[moduleId] = updatedModules[moduleId];
            }
          }
          // Owners unchanged on BTS still need fresh worklet contexts. Cached
          // factories are only fallbacks; any downloaded factory takes priority
          // regardless of which update chunk finishes loading first.
          (update.lynxRefreshModules || []).forEach(function(moduleId) {
            if (
              __webpack_require__.c[moduleId]
              && !$RuntimeGlobals_hasOwnProperty$(currentUpdate, moduleId)
            ) {
              currentUpdate[moduleId] = __webpack_require__.m[moduleId];
              if (updatedModulesList) updatedModulesList.push(moduleId);
            }
          });
          if (runtime) currentUpdateRuntime.push(runtime);
          resolve();
        },
      );
    });
  }
}
