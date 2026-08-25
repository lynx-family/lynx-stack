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
  var aliasModuleCache = function(moduleCache, moduleId) {
    Object.defineProperty($RuntimeGlobals_moduleCache$, moduleId, {
      configurable: true,
      get: function() {
        return moduleCache[moduleId];
      },
      set: function(module) {
        moduleCache[moduleId] = module;
      },
    });
  };
  // object to store loaded chunks
  // "1" means "loaded", otherwise not loaded yet
  var installChunk = function(chunk) {
    var moreModules = chunk.modules,
      chunkIds = chunk.ids,
      runtime = chunk.runtime;
    // Module instances live on the chunk object, so they are shared exactly
    // when the loader hands the same chunk object to more than one page.
    var moduleCache = chunk.__moduleCache || (chunk.__moduleCache = {});
    for (var moduleId in moreModules) {
      if ($RuntimeGlobals_hasOwnProperty$(moreModules, moduleId)) {
        $RuntimeGlobals_moduleFactories$[moduleId] = moreModules[moduleId];
        aliasModuleCache(moduleCache, moduleId);
      }
    }
    if (runtime) runtime(__webpack_require__);
    for (var i = 0; i < chunkIds.length; i++) installedChunks[chunkIds[i]] = 1;
    if ($WITH_ONLOAD$) {
      $RuntimeGlobals_onChunksLoaded$();
    }
  };
}
