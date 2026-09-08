// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function isWorkletObj(obj: unknown): boolean {
  if (__MAIN_THREAD__) {
    return true;
  }

  if (!obj) {
    return false;
  }
  // Transform-free runtimes (e.g. @lynx-js/preact-runtime) run main-thread
  // functions on the background thread; plain functions are valid there.
  if (
    (globalThis as { __TRANSFORM_FREE_MTS__?: boolean }).__TRANSFORM_FREE_MTS__
    && typeof obj === 'function'
  ) {
    return true;
  }
  return typeof obj === 'object' && '_wkltId' in obj;
}
