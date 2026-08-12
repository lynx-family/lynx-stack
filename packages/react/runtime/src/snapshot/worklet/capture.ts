// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMainThreadObjectHandle } from './ref/mainThreadObject.js';

/**
 * Preserve opaque main-thread object handles when the worklet transform narrows a
 * captured member expression. Ordinary objects keep the transform's compact
 * fallback shape. New transformed output omits the fallback so it can evaluate
 * that shape lazily with `captureMainThreadObject(source) ?? fallback`. The
 * two-argument overload remains compatible with already-built output.
 *
 * @internal
 */
export function captureMainThreadObject<T>(source: T): T | undefined;
/** @internal */
export function captureMainThreadObject<T, F>(source: T, fallback: F): T | F;
/** @internal */
export function captureMainThreadObject<T, F>(source: T, fallback?: F): T | F | undefined {
  return isMainThreadObjectHandle(source) ? source : fallback;
}

/** @deprecated Compatibility alias for transformed output from `MainThreadValue`. */
export const workletCapture: typeof captureMainThreadObject = captureMainThreadObject;
