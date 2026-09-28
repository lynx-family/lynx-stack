/*
// Copyright 2026 The Lynx Authors. All rights reserved.
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
  var installChunkWithoutSharing = installChunk;
  installChunk = function(chunk) {
    var moreModules = chunk.modules;
    var moduleCache = chunk.__moduleCache || (chunk.__moduleCache = {});
    for (var moduleId in moreModules) {
      if ($RuntimeGlobals_hasOwnProperty$(moreModules, moduleId)) {
        aliasModuleCache(moduleCache, moduleId);
      }
    }
    installChunkWithoutSharing(chunk);
  };
}
