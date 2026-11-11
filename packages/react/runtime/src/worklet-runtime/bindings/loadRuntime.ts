// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '../global.js';

/**
 * Loads the legacy main-thread worklet chunk or reuses an initialized runtime.
 * @param __schema - The dynamic component entry for loading the Lepus chunk.
 * @returns Whether the worklet runtime was loaded and initialized successfully.
 */
function loadWorkletRuntime(__schema?: string): boolean {
  if (typeof __LoadLepusChunk === 'undefined') {
    return false;
  }
  if (globalThis.lynxWorkletImpl) {
    return true;
  }
  return __LoadLepusChunk('worklet-runtime', {
    dynamicComponentEntry: __schema,
    chunkType: 0,
  });
}

export { loadWorkletRuntime };
