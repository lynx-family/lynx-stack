/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
// @ts-nocheck

var $JS_MATCHER$ = undefined;

export default function() {
  if ($RuntimeGlobals_ensureChunkHandlers$) {
    $RuntimeGlobals_ensureChunkHandlers$.require = function(chunkId, promises) {
      var installedChunkData = installedChunks[chunkId];
      // "1" is the signal for "already loaded"
      if (installedChunkData !== 1) {
        if (!installedChunkData) {
          if ($JS_MATCHER$) {
            installChunk(
              lynx.requireModule(
                $RuntimeGlobals_publicPath$
                  + $RuntimeGlobals_getChunkScriptFilename$(chunkId),
              ),
            );
          } else {
            installedChunks[chunkId] = 1;
          }
        }
      }
    };
  }
  if (typeof installChunk !== 'undefined') {
    $RuntimeGlobals_externalInstallChunk$ = installChunk;
  }
}
