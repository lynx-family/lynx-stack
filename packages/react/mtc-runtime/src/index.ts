// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTC Runtime entry point.
 *
 * This IIFE is loaded on the main thread when MTC components are detected
 * in the bundle. It follows the same pattern as worklet-runtime:
 * - Guards against double initialization
 * - Registers patch handlers for MTC operations
 * - Exposes globalThis.registerMTC for compiled component registration
 */

import { initMtcRuntime, registerMTCComponent } from './mtcRuntime.js';

// Guard against double initialization (same pattern as worklet-runtime)
const g = globalThis as typeof globalThis & MtcGlobals;
if (g.__mtc_runtime_init__ === undefined) {
  g.__mtc_runtime_init__ = true;

  // Expose registerMTC globally for compiled Lepus code
  g.registerMTC = registerMTCComponent;

  // The actual initialization will be called when the runtime dependencies
  // (registerPatchHandler, snapshotInstanceManager, destroyTasks) are available.
  // This happens via the binding layer.
  g.__initMtcRuntime = initMtcRuntime;
}

export { initMtcRuntime, registerMTCComponent };
