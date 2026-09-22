// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type {
  MainThreadRefInitValuePatch,
  Worklet,
  WorkletRef,
  WorkletRefId,
  WorkletRefImpl,
} from './bindings/types.js';
import {
  assertCompatibleMainThreadObject,
  clearFirstScreenMainThreadObjects,
  createMainThreadObject,
  initMainThreadObjects,
  isRealizedMainThreadObject,
  registerMainThreadObjectType,
  releaseMainThreadObject,
  retainHydratedMainThreadObject,
} from './mainThreadObject.js';
import type { MainThreadObjectFactory } from './mainThreadObject.js';
import { mainThreadFlushLoopMark } from './utils/mainThreadFlushLoopGuard.js';
import { profile } from './utils/profile.js';

interface RefImpl {
  _workletRefMap: Record<WorkletRefId, object>;
  _firstScreenWorkletRefMap: Record<WorkletRefId, object>;
  updateWorkletRef(
    refImpl: WorkletRefImpl<Element | null>,
    element: ElementNode | null,
  ): void;
  updateWorkletRefInitValueChanges(
    patch: MainThreadRefInitValuePatch,
  ): void;
  registerMainThreadObjectType(
    type: string,
    create: MainThreadObjectFactory | Worklet,
  ): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;
function initWorkletRef(): RefImpl {
  initMainThreadObjects();
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
    registerMainThreadObjectType,
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
  return ref;
};

function createWorkletValue(refImpl: WorkletRefImpl<unknown>): object {
  return !refImpl._type || refImpl._type === 'main-thread'
    ? createWorkletRef(refImpl._wvid, refImpl._initValue)
    : createMainThreadObject(refImpl);
}

function isMutableCell(value: unknown): value is WorkletRef<unknown> {
  return typeof value === 'object' && value !== null
    && typeof (value as Partial<WorkletRef<unknown>>)._wvid === 'number'
    && Object.prototype.hasOwnProperty.call(value, 'current');
}

function isHydratedWorkletValue(value: unknown): value is object {
  return typeof value === 'object' && value !== null
    && (isRealizedMainThreadObject(value) || isMutableCell(value));
}

function assertCompatibleWorkletValue(
  handle: WorkletRefImpl<unknown>,
  value: object,
  operation: 'hydration' | 'initialization patch',
): void {
  let actualKind: 'typed-object' | 'mutable-cell' | undefined;
  if (isRealizedMainThreadObject(value)) {
    actualKind = 'typed-object';
  } else if (isMutableCell(value)) {
    actualKind = 'mutable-cell';
  }
  if (!actualKind) {
    throw new Error(
      `Cannot apply MainThreadObject ${operation} for handle ${handle._wvid}: the existing target has no worklet-value metadata.`,
    );
  }

  const expectedType = handle._type;
  const expectedKind = !expectedType || expectedType === 'main-thread'
    ? 'mutable-cell'
    : 'typed-object';
  if (actualKind !== expectedKind) {
    throw new Error(
      `Worklet value kind mismatch during ${operation} for handle ${handle._wvid}: background handle expects ${expectedKind}, but the main-thread target is ${actualKind}.`,
    );
  }
  if (actualKind === 'typed-object') {
    assertCompatibleMainThreadObject(handle, value, operation);
  }
}

const getFromWorkletRefMap = (
  refImpl: WorkletRefImpl<unknown>,
): object | undefined => {
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
    value = impl!._firstScreenWorkletRefMap[id] ??= createWorkletValue(refImpl);
  } else {
    value = impl!._workletRefMap[id];
  }

  /* v8 ignore next 3 */
  if (__DEV__ && value === undefined) {
    throw new Error('MainThreadRef is not initialized: ' + id);
  }
  return value;
};

function removeValueFromWorkletRefMap(id: WorkletRefId): void {
  releaseMainThreadObject(impl!._workletRefMap[id]);
  delete impl!._workletRefMap[id];
}

function hydrateWorkletValue(
  handle: WorkletRefImpl<unknown>,
  value: object,
): void {
  assertCompatibleWorkletValue(handle, value, 'hydration');
  const previous = impl!._workletRefMap[handle._wvid];
  if (previous !== value) {
    releaseMainThreadObject(previous);
  }
  impl!._workletRefMap[handle._wvid] = value;
  retainHydratedMainThreadObject(value);
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
  (getFromWorkletRefMap(handle) as WorkletRef<Element | null>).current = element
    ? new Element(element)
    : null;
}

function updateWorkletRefInitValueChanges(
  patch: MainThreadRefInitValuePatch,
): void {
  profile('updateWorkletRefInitValueChanges', () => {
    let firstError: unknown;
    let hasError = false;
    patch.forEach(([id, value, type]) => {
      try {
        const handle = {
          _wvid: id,
          _initValue: value,
          _type: type,
        } as WorkletRefImpl<unknown>;
        const existing = impl!._workletRefMap[id];
        if (existing) {
          assertCompatibleWorkletValue(
            handle,
            existing,
            'initialization patch',
          );
        } else {
          impl!._workletRefMap[id] = createWorkletValue(handle);
        }
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    });
    if (hasError) {
      throw firstError;
    }
  });
}

function clearFirstScreenWorkletRefMap(): void {
  clearFirstScreenMainThreadObjects();
  impl!._firstScreenWorkletRefMap = {};
}

export {
  type RefImpl,
  createWorkletRef,
  initWorkletRef,
  getFromWorkletRefMap,
  removeValueFromWorkletRefMap,
  hydrateWorkletValue,
  isHydratedWorkletValue,
  updateWorkletRefInitValueChanges,
};
