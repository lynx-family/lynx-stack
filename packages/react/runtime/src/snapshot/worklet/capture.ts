// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Preserve opaque main-thread values when the worklet transform narrows a
 * captured member expression. Ordinary objects keep the transform's compact
 * fallback shape.
 *
 * @internal
 */
export function workletCapture<T, F>(source: T, fallback: F): T | F {
  if (
    source !== null
    && typeof source === 'object'
    && (source as { __MAIN_THREAD_VALUE__?: unknown }).__MAIN_THREAD_VALUE__ === true
  ) {
    return source;
  }
  return fallback;
}
