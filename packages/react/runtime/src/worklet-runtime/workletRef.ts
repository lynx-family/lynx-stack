// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type { WorkletRef, WorkletRefId, WorkletRefImpl } from './bindings/types.js';
import { mainThreadFlushLoopMark } from './utils/mainThreadFlushLoopGuard.js';
import { profile } from './utils/profile.js';

interface RefImpl {
  _workletRefMap: Record<WorkletRefId, WorkletRef<unknown>>;
  _firstScreenWorkletRefMap: Record<WorkletRefId, WorkletRef<unknown>>;
  updateWorkletRef(
    refImpl: WorkletRefImpl<Element | null>,
    element: ElementNode | null,
  ): void;
  updateWorkletRefInitValueChanges(patch: ([number, unknown] | [number, unknown, string])[]): void;
  registerMainThreadValueType(type: string, factory: MainThreadValueFactory): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;
type MainThreadValueFactory = (initValue: unknown) => object;
const mainThreadValueFactories = new Map<string, MainThreadValueFactory>();
const hydratedWorkletValues = new WeakSet<object>();

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
    registerMainThreadValueType,
    clearFirstScreenWorkletRefMap,
  });
}

const createWorkletRef = <T>(
  id: WorkletRefId,
  value: T,
): WorkletRef<T> => {
  const ref = {
    current: value,
    _wvid: id,
  };
  hydratedWorkletValues.add(ref);
  return ref;
};

function registerMainThreadValueType(type: string, factory: MainThreadValueFactory): void {
  mainThreadValueFactories.set(type, factory);
}

function createWorkletValue<T>(refImpl: WorkletRefImpl<T>): WorkletRef<T> {
  const type = refImpl._type;
  if (!type || type === 'main-thread') {
    return createWorkletRef(refImpl._wvid, refImpl._initValue);
  }

  const factory = mainThreadValueFactories.get(type);
  if (!factory) {
    throw new Error(`MainThreadValue type is not registered: ${type}`);
  }

  const value = factory(refImpl._initValue);
  hydratedWorkletValues.add(value);
  return value as WorkletRef<T>;
}

function isHydratedWorkletValue(value: unknown): value is object {
  return typeof value === 'object' && value !== null && hydratedWorkletValues.has(value);
}

const getFromWorkletRefMap = <T>(
  refImpl: WorkletRefImpl<T>,
): WorkletRef<T> => {
  const id = refImpl._wvid;
  /* v8 ignore next 3 */
  if (__DEV__) {
    mainThreadFlushLoopMark(`MainThreadRef:get id=${id}`);
  }
  let value;
  if (id < 0) {
    // At the first screen rendering, the worklet ref is created with a negative ID.
    // Might be called in two scenarios:
    // 1. In MTS events
    // 2. In `main-thread:ref`
    value = impl!._firstScreenWorkletRefMap[id] as WorkletRef<T>;
    if (!value) {
      value = impl!._firstScreenWorkletRefMap[id] = createWorkletValue(refImpl);
    }
  } else {
    value = impl!._workletRefMap[id] as WorkletRef<T>;
  }

  /* v8 ignore next 3 */
  if (__DEV__ && value === undefined) {
    throw new Error('MainThreadRef is not initialized: ' + id);
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
  patch: ([WorkletRefId, unknown] | [WorkletRefId, unknown, string])[],
): void {
  profile('updateWorkletRefInitValueChanges', () => {
    patch.forEach(([id, value, type]) => {
      if (!impl!._workletRefMap[id]) {
        impl!._workletRefMap[id] = createWorkletValue({
          _wvid: id,
          _initValue: value,
          _type: type,
        } as WorkletRefImpl<unknown>);
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
  isHydratedWorkletValue,
};
