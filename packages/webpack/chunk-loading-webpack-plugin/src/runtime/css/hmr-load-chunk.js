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
  $RuntimeGlobals_hmrDownloadUpdateHandlers$.miniCss = function(
    chunkIds,
    removedChunks,
    removedModules,
    promises,
    applyHandlers,
    updatedModulesList,
  ) {
    chunkIds.forEach(function(chunkId) {
      promises.push(loadStylesheet(chunkId));
    });
  };
}
