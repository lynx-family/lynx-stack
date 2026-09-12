// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, JsFnHandle, Worklet, WorkletRefImpl } from './types.js';
import type { Element } from '../api/element.js';

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
function updateWorkletRefInitValueChanges(
  patch?: ([number, unknown] | [number, unknown, string, number])[],
): void {
  if (patch) {
    globalThis.lynxWorkletImpl?._refImpl.updateWorkletRefInitValueChanges(patch);
  }
}

/**
 * Register a definition for an opaque main-thread object type.
 *
 * @internal
 */
function registerMainThreadObjectType(
  type: string,
  create: ((initialValue: unknown) => object) | Worklet,
  protocolVersion: number,
): void {
  const refImpl = globalThis.lynxWorkletImpl?._refImpl;
  if (!refImpl || typeof refImpl.registerMainThreadObjectType !== 'function') {
    throw new Error(
      'MainThreadObject requires a newer ReactLynx main-thread runtime. Upgrade the main template runtime or rebuild the lazy bundle with a compatible @lynx-js/react version.',
    );
  }
  refImpl.registerMainThreadObjectType(type, create, protocolVersion);
}

/**
 * Releases the temporary negative-ID MainThreadRefs after hydration handoff.
 */
function clearFirstScreenMainThreadRefs(): void {
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

/**
 * Set whether EOM operations should flush the element tree.
 *
 * @internal
 */
function setEomShouldFlushElementTree(value: boolean) {
  globalThis.lynxWorkletImpl?._eomImpl.setShouldFlush(value);
}

/**
 * Runs a task on the main thread.
 *
 * @internal
 */
function runRunOnMainThreadTask(task: Worklet, params: ClosureValueType[], resolveId: number): void {
  globalThis.lynxWorkletImpl?._runRunOnMainThreadTask(task, params, resolveId);
}

export {
  runWorkletCtx,
  updateWorkletRef,
  updateWorkletRefInitValueChanges,
  clearFirstScreenMainThreadRefs,
  registerMainThreadObjectType,
  registerWorklet,
  delayRunOnBackground,
  setEomShouldFlushElementTree,
  runRunOnMainThreadTask,
};
