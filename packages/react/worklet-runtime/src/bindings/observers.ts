// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Worklet } from './types.js';

/**
 * This function must be called when a worklet context is updated.
 *
 * @param worklet - The worklet to be updated
 * @param oldWorklet - The old worklet context
 * @param isFirstScreen - Whether it is before the hydration is finished
 * @param element - The element
 */
export function onWorkletCtxUpdate(
  worklet: Worklet,
  oldWorklet: Worklet | null | undefined,
  isFirstScreen: boolean,
  element: ElementNode,
): void {
  globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.addRef(worklet._execId!, worklet);
  if (isFirstScreen && oldWorklet) {
    globalThis.lynxWorkletImpl?._hydrateCtx(worklet, oldWorklet);
  }
  // For old version dynamic component compatibility.
  if (isFirstScreen) {
    globalThis.lynxWorkletImpl?._eventDelayImpl.runDelayedWorklet(worklet, element);
  }
}

/**
 * This must be called when the hydration is finished.
 */
export function onHydrationFinished(): void {
  globalThis.lynxWorkletImpl?._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
  globalThis.lynxWorkletImpl?._refImpl.clearFirstScreenWorkletRefMap();
  // For old version dynamic component compatibility.
  globalThis.lynxWorkletImpl?._eventDelayImpl.clearDelayedWorklets();
}
