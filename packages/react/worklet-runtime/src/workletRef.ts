// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type { WorkletRef, WorkletRefId, WorkletRefImpl } from './bindings/types.js';
import { profile } from './utils/profile.js';

interface RefImpl {
  _workletRefMap: Record<WorkletRefId, WorkletRef<unknown>>;
  _firstScreenWorkletRefMap: Record<WorkletRefId, WorkletRef<unknown>>;
  updateWorkletRef(
    refImpl: WorkletRefImpl<Element | null>,
    element: ElementNode | null,
  ): void;
  updateWorkletRefInitValueChanges(patch: [number, unknown][]): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;

function initWorkletRef(): RefImpl {
  return (impl = {
    _workletRefMap: {},
    /**
     * Map of worklet refs that are created during first screen rendering.
     * These refs are created with negative IDs and need to be hydrated
     * when the app starts. The map is cleared after hydration is complete
     * to free up memory.
     */
    _firstScreenWorkletRefMap: {},
    updateWorkletRef,
    updateWorkletRefInitValueChanges,
    clearFirstScreenWorkletRefMap,
  });
}

const createWorkletRef = <T>(
  id: WorkletRefId,
  value: T,
): WorkletRef<T> => {
  return {
    current: value,
    _wvid: id,
  };
};

const getFromWorkletRefMap = <T>(
  refImpl: WorkletRefImpl<T>,
): WorkletRef<T> => {
  const id = refImpl._wvid;
  let value;
  if (id < 0) {
    // At the first screen rendering, the worklet ref is created with a negative ID.
    // Might be called in two scenarios:
    // 1. In MTS events
    // 2. In `main-thread:ref`
    value = impl!._firstScreenWorkletRefMap[id] as WorkletRef<T>;
    if (!value) {
      value = impl!._firstScreenWorkletRefMap[id] = createWorkletRef(id, refImpl._initValue);
    }
  } else {
    value = impl!._workletRefMap[id] as WorkletRef<T>;
  }

  /* v8 ignore next 3 */
  if (__DEV__ && value === undefined) {
    throw new Error('Worklet: ref is not initialized: ' + id);
  }
  return value;
};

function removeValueFromWorkletRefMap(id: WorkletRefId): void {
  delete impl!._workletRefMap[id];
}

/**
 * Create an element instance of the given element node, then set the worklet value to it.
 * This is called in `snapshotContextUpdateWorkletRef`.
 * @param handle handle of the worklet value.
 * @param element the element node.
 */
function updateWorkletRef(
  handle: WorkletRefImpl<Element | null>,
  element: ElementNode | null,
): void {
  getFromWorkletRefMap(handle).current = element
    ? new Element(element)
    : null;
}

function updateWorkletRefInitValueChanges(
  patch: [WorkletRefId, unknown][],
): void {
  profile('updateWorkletRefInitValueChanges', () => {
    patch.forEach(([id, value]) => {
      if (!impl!._workletRefMap[id]) {
        impl!._workletRefMap[id] = createWorkletRef(id, value);
      }
    });
  });
}

function clearFirstScreenWorkletRefMap(): void {
  impl!._firstScreenWorkletRefMap = {};
}

export {
  type RefImpl,
  createWorkletRef,
  initWorkletRef,
  getFromWorkletRefMap,
  removeValueFromWorkletRefMap,
  updateWorkletRefInitValueChanges,
};
