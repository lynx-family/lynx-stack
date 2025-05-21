// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '../global.js';

/**
 * Loads and initializes the Lepus chunk in the main thread.
 * @param __schema - The dynamic component entry for loading the Lepus chunk.
 * @returns A boolean indicating whether the Lepus chunk was loaded and initialized successfully.
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
