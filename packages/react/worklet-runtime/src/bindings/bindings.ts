// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, JsFnHandle, Worklet, WorkletRefImpl } from './types.js';
import type { Element } from '../api/element.js';

/**
 * This function must be called when a worklet context is updated.
 *
 * @param worklet - The worklet to be updated
 * @param oldWorklet - The old worklet context
 * @param isFirstScreen - Whether it is before the hydration is finished
 * @param element - The element
 * @internal
 */
function onWorkletCtxUpdate(
  worklet: Worklet,
  oldWorklet: Worklet | null | undefined,
  isFirstScreen: boolean,
  element: ElementNode,
): void {
  globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.addRef(worklet._execId!, worklet);
  if (isFirstScreen && oldWorklet) {
    globalThis.lynxWorkletImpl?._hydrateCtx(worklet, oldWorklet);
  }
  globalThis.lynxWorkletImpl?._eventDelayImpl.runDelayedWorklet(worklet, element);
}

/**
 * Executes the worklet ctx.
 * @param worklet - The Worklet ctx to run.
 * @param params - An array as parameters of the worklet run.
 */
function runWorkletCtx(worklet: Worklet, params: ClosureValueType[]): unknown {
  return globalThis.runWorklet?.(worklet, params);
}

/**
 * Save an element to a `WorkletRef`.
 *
 * @param workletRef - The `WorkletRef` to be updated.
 * @param element - The element.
 * @internal
 */
function updateWorkletRef(workletRef: WorkletRefImpl<Element>, element: ElementNode | null): void {
  globalThis.lynxWorkletImpl?._refImpl.updateWorkletRef(workletRef, element);
}

/**
 * Update the initial value of the `WorkletRef`.
 *
 * @param patch - An array containing the index and new value of the worklet value.
 */
function updateWorkletRefInitValueChanges(patch?: [number, unknown][]): void {
  if (patch) {
    globalThis.lynxWorkletImpl?._refImpl.updateWorkletRefInitValueChanges(patch);
  }
}

/**
 * This must be called when the hydration is finished.
 *
 * @internal
 */
function onHydrationFinished(): void {
  globalThis.lynxWorkletImpl?._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
  globalThis.lynxWorkletImpl?._refImpl.clearFirstScreenWorkletRefMap();
}

/**
 * Register a worklet.
 *
 * @internal
 */
function registerWorklet(type: string, id: string, worklet: (...args: unknown[]) => unknown): void {
  globalThis.registerWorklet(type, id, worklet);
}

/**
 * Delay a runOnBackground after hydration.
 *
 * @internal
 */
function delayRunOnBackground(fnObj: JsFnHandle, fn: (fnId: number, execId: number) => void): void {
  globalThis.lynxWorkletImpl?._runOnBackgroundDelayImpl.delayRunOnBackground(fnObj, fn);
}

export {
  onWorkletCtxUpdate,
  runWorkletCtx,
  updateWorkletRef,
  updateWorkletRefInitValueChanges,
  onHydrationFinished,
  registerWorklet,
  delayRunOnBackground,
};
