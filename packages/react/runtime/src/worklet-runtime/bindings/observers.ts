// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Worklet } from './types.js';

/**
 * Hydrates a new worklet ctx from the first-screen ctx without requiring a
 * native Element. Backends compose their own replay semantics around this.
 */
export function hydrateWorkletCtx(worklet: Worklet, oldWorklet: Worklet): void {
  globalThis.lynxWorkletImpl?._hydrateCtx(worklet, oldWorklet);
}

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
  if (isFirstScreen && oldWorklet) {
    hydrateWorkletCtx(worklet, oldWorklet);
  }
  // For old version dynamic component compatibility.
  if (isFirstScreen) {
    globalThis.lynxWorkletImpl?._eventDelayImpl.runDelayedWorklet(worklet, element);
  }
}

export function retainWorkletCtx(worklet: Worklet): void {
  if (worklet._execId !== undefined) {
    globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.addRef(worklet._execId, worklet);
  }
}

export function flushDelayedRunOnBackgroundFunctions(): void {
  globalThis.lynxWorkletImpl?._runOnBackgroundDelayImpl?.runDelayedBackgroundFunctions?.();
}

export function clearDelayedRunOnBackgroundFunctions(): void {
  globalThis.lynxWorkletImpl?._runOnBackgroundDelayImpl?.clearDelayedBackgroundFunctions?.();
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
