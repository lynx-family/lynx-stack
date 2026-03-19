// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '../global.js';

/**
 * Guard function for worklet runtime availability.
 *
 * The worklet-runtime is now bundled directly into the main-thread.js entry,
 * so there is no need to load it via `__LoadLepusChunk`. This function is
 * kept as a guard because SWC-generated code still calls it before
 * `registerWorkletInternal`.
 *
 * @param __schema - Unused. Kept for backward compatibility with SWC-generated call sites.
 * @returns Whether the worklet runtime has been initialized.
 */
function loadWorkletRuntime(__schema?: string): boolean {
  return !!globalThis.lynxWorkletImpl;
}

export { loadWorkletRuntime };
