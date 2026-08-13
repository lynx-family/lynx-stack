// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMainThreadObjectHandle } from './ref/mainThreadObject.js';

/**
 * Preserve opaque main-thread object handles when the worklet transform narrows a
 * captured member expression. Ordinary objects keep the transform's compact
 * fallback shape.
 *
 * @internal
 */
export function captureMainThreadObject<T, F>(source: T, fallback: F): T | F {
  return isMainThreadObjectHandle(source) ? source : fallback;
}

/** @deprecated Compatibility alias for transformed output from `MainThreadValue`. */
export const workletCapture: typeof captureMainThreadObject = captureMainThreadObject;
