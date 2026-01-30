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
  updateWorkletRefInitValueChanges(patch: [number, unknown, string?][]): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;

/**
 * Registry for custom MainThreadValue types.
 * Maps type string (e.g., 'main-thread', 'motion-value') to constructor.
 */
/**
 * Registry for custom MainThreadValue types.
 * Maps type string (e.g., 'main-thread', 'motion-value') to constructor.
 */
const typeRegistry: Record<string, new(initValue: unknown, type: string) => unknown> = {};

/**
 * Register a custom MainThreadValue class for hydration on the main thread.
 * @param type - Unique type identifier (e.g., '@my-lib/MotionValue')
 * @param Ctor - The class constructor
 */
export function registerMainThreadValueClass(
  Ctor: new(initValue: unknown, type: string) => unknown,
  type: string,
): void {
  typeRegistry[type] = Ctor;

  // Also add to lynxWorkletImpl if already initialized
  if (globalThis.lynxWorkletImpl?._mainThreadValueClassMap) {
    globalThis.lynxWorkletImpl._mainThreadValueClassMap[type] = Ctor;
  }
}

/**
 * Get the type registry for use during worklet initialization.
 */
export function getMainThreadValueClassMap(): Record<string, new(initValue: unknown, type: string) => unknown> {
  return typeRegistry;
}

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

/**
 * Hydrate a WorkletRef from its serialized form.
 * Uses the type registry to instantiate the correct class.
 */
function hydrateWorkletRef<T>(refImpl: WorkletRefImpl<T>): WorkletRef<T> {
  const type = refImpl._type ?? 'main-thread';
  // Check local typeRegistry and global lynxWorkletImpl registry
  const Ctor = typeRegistry[type]
    ?? globalThis.lynxWorkletImpl?._mainThreadValueClassMap?.[type];

  if (Ctor) {
    // Instantiate the registered class
    const instance = new Ctor(refImpl._initValue, type) as WorkletRef<T>;
    // Assign the ID
    (instance as { _wvid: WorkletRefId })._wvid = refImpl._wvid;
    return instance;
  }
  // Fallback: plain object with .current
  return createWorkletRef(refImpl._wvid, refImpl._initValue);
}

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
      value = impl!._firstScreenWorkletRefMap[id] = hydrateWorkletRef(refImpl);
    }
  } else {
    value = impl!._workletRefMap[id] as WorkletRef<T>;
    if (!value) {
      value = impl!._workletRefMap[id] = hydrateWorkletRef(refImpl);
    }
  }

  /* v8 ignore next 3 */
  if (__DEV__ && value === undefined) {
    throw new Error('Worklet: ref is not initialized: ' + id);
  }
  return value;
};

function removeValueFromWorkletRefMap(id: WorkletRefId): void {
  delete impl!._workletRefMap[id];
  delete impl!._firstScreenWorkletRefMap[id];
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
  patch: [WorkletRefId, unknown, string?][],
): void {
  profile('updateWorkletRefInitValueChanges', () => {
    patch.forEach(([id, value, type]) => {
      const existing = impl!._workletRefMap[id];
      if (existing) {
        // Update the existing ref's value
        existing.current = value;
      } else {
        // Create a new ref with type-aware hydration
        impl!._workletRefMap[id] = hydrateWorkletRef({
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
};
