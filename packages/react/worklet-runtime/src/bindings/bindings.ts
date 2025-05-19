// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, Worklet, WorkletRefImpl } from './types.js';
import type { Element } from '../api/element.js';

/**
 * This function must be called when a worklet context is updated.
 *
 * @param worklet - The worklet to be updated
 * @param _element - The element associated with the worklet
 * @internal
 */
function onWorkletCtxUpdate(worklet: Worklet, _element: ElementNode): void {
  globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager?.addRef(worklet._execId!, worklet);
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
  // do nothing
}

/**
 * Register a worklet.
 *
 * @internal
 */
function registerWorklet(type: string, id: string, worklet: (...args: any[]) => any): void {
  globalThis.registerWorklet(type, id, worklet);
}

export {
  onWorkletCtxUpdate,
  runWorkletCtx,
  updateWorkletRef,
  updateWorkletRefInitValueChanges,
  onHydrationFinished,
  registerWorklet,
};
