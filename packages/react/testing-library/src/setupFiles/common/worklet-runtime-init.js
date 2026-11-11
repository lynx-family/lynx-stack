// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// MIXED test modules can evaluate on the background thread. Initialize the
// emulated main-thread runtime, then restore the caller's thread.
const isBackground = !__MAIN_THREAD__;
globalThis.lynxTestingEnv.switchToMainThread();
try {
  if (globalThis.lynxWorkletImpl === undefined) {
    globalThis.onInitWorkletRuntime();
  }
} finally {
  if (isBackground) {
    globalThis.lynxTestingEnv.switchToBackgroundThread();
  }
}

// Resolve the owner when registration runs: MIXED modules can import this entry
// before the main-thread globals are active.
export function registerWorklet(type, id, worklet) {
  globalThis.registerWorkletInternal(type, id, worklet);
}
