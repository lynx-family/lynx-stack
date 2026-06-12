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

var $CHUNK_MAP$ = undefined;

export default function() {
  var installedCssChunks = { $INSTALLED_CHUNKS$ };

  // object to store loaded CSS chunks
  $RuntimeGlobals_ensureChunkHandlers$.miniCss = function(chunkId, promises) {
    var cssChunks = $CHUNK_MAP$;
    if (installedCssChunks[chunkId]) promises.push(installedCssChunks[chunkId]);
    else if (installedCssChunks[chunkId] !== 0 && cssChunks[chunkId]) {
      promises.push(
        installedCssChunks[chunkId] = loadStylesheet(chunkId).then(function() {
          installedCssChunks[chunkId] = 0;
        }, function(e) {
          delete installedCssChunks[chunkId];
          throw e;
        }),
      );
    }
  };
}
