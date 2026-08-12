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
  updateWorkletRefInitValueChanges(
    patch: ([number, unknown] | [number, unknown, string, number])[],
  ): void;
  registerMainThreadObjectType(
    type: string,
    create: MainThreadObjectFactory,
    dispose: MainThreadObjectDisposer | undefined,
    protocolVersion: number,
    hydrate?: MainThreadObjectHydrator,
  ): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;
const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

type MainThreadObjectFactory = (initialValue: unknown) => object;
type MainThreadObjectDisposer = (object: object) => void;
type MainThreadObjectHydrator = (object: object, firstScreenObject: object) => void;
interface MainThreadObjectDefinition {
  create: MainThreadObjectFactory;
  dispose: MainThreadObjectDisposer | undefined;
  hydrate: MainThreadObjectHydrator | undefined;
}

const mainThreadObjectDefinitions = new Map<string, MainThreadObjectDefinition>();
let realizedMainThreadObjectDefinitions = new WeakMap<object, MainThreadObjectDefinition>();
let hydratedWorkletValues = new WeakSet<object>();

function initWorkletRef(): RefImpl {
  mainThreadObjectDefinitions.clear();
  realizedMainThreadObjectDefinitions = new WeakMap();
  hydratedWorkletValues = new WeakSet();
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
  hydratedWorkletValues.add(ref);
  return ref;
};

function registerMainThreadObjectType(
  type: string,
  create: MainThreadObjectFactory,
  dispose: MainThreadObjectDisposer | undefined,
  protocolVersion: number,
  hydrate?: MainThreadObjectHydrator,
): void {
  assertMainThreadObjectProtocolVersion(type, protocolVersion);
  const registered = mainThreadObjectDefinitions.get(type);
  if (registered) {
    if (
      registered.create !== create
      || registered.dispose !== dispose
      || registered.hydrate !== hydrate
    ) {
      throw new Error(
        `Conflicting MainThreadObject registration for type "${type}". A type key must always use the same create, dispose, and hydrate functions.`,
      );
    }
    return;
  }
  mainThreadObjectDefinitions.set(type, { create, dispose, hydrate });
}

function createWorkletValue<T>(refImpl: WorkletRefImpl<T>): WorkletRef<T> {
  const type = refImpl._type;
  if (!type || type === 'main-thread') {
    return createWorkletRef(refImpl._wvid, refImpl._initValue);
  }

  assertMainThreadObjectProtocolVersion(type, refImpl._mtoVersion);
  const definition = mainThreadObjectDefinitions.get(type);
  if (!definition) {
    throw new Error(
      `MainThreadObject type is not registered: "${type}". Define and register the type during main-thread render before capturing its handle.`,
    );
  }

  const value = definition.create(refImpl._initValue);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`MainThreadObject type "${type}" created a non-object value.`);
  }
  realizedMainThreadObjectDefinitions.set(value, definition);
  hydratedWorkletValues.add(value);
  return value as WorkletRef<T>;
}

function assertMainThreadObjectProtocolVersion(type: string, protocolVersion: number | undefined): void {
  if (protocolVersion !== MAIN_THREAD_OBJECT_PROTOCOL_VERSION) {
    throw new Error(
      `MainThreadObject protocol mismatch for type "${type}": runtime supports version ${MAIN_THREAD_OBJECT_PROTOCOL_VERSION}, but the handle or bundle uses ${
        String(protocolVersion)
      }. Rebuild the main template and lazy bundle with compatible @lynx-js/react versions.`,
    );
  }
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
  disposeMainThreadObject(impl!._workletRefMap[id]);
  delete impl!._workletRefMap[id];
}

function hydrateWorkletValue(id: WorkletRefId, value: WorkletRef<unknown>): void {
  const previous = impl!._workletRefMap[id];
  const previousDefinition = getMainThreadObjectDefinition(previous);
  const valueDefinition = getMainThreadObjectDefinition(value);
  if (
    previous
    && previousDefinition
    && previousDefinition === valueDefinition
    && previousDefinition.hydrate
  ) {
    previousDefinition.hydrate(previous, value);
    disposeMainThreadObject(value);
    return;
  }
  if (previous !== value) {
    disposeMainThreadObject(previous);
  }
  impl!._workletRefMap[id] = value;
}

function getMainThreadObjectDefinition(
  value: unknown,
): MainThreadObjectDefinition | undefined {
  return typeof value === 'object' && value !== null
    ? realizedMainThreadObjectDefinitions.get(value)
    : undefined;
}

function disposeMainThreadObject(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const definition = realizedMainThreadObjectDefinitions.get(value);
  if (!definition) {
    return;
  }
  realizedMainThreadObjectDefinitions.delete(value);
  hydratedWorkletValues.delete(value);
  definition.dispose?.(value);
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
  patch: ([WorkletRefId, unknown] | [WorkletRefId, unknown, string, number])[],
): void {
  profile('updateWorkletRefInitValueChanges', () => {
    patch.forEach(([id, value, type, protocolVersion]) => {
      if (!impl!._workletRefMap[id]) {
        impl!._workletRefMap[id] = createWorkletValue({
          _wvid: id,
          _initValue: value,
          _type: type,
          _mtoVersion: protocolVersion,
        } as WorkletRefImpl<unknown>);
      }
    });
  });
}

function clearFirstScreenWorkletRefMap(): void {
  const retainedValues = new Set(Object.values(impl!._workletRefMap));
  Object.values(impl!._firstScreenWorkletRefMap).forEach((value) => {
    if (!retainedValues.has(value)) {
      disposeMainThreadObject(value);
    }
  });
  impl!._firstScreenWorkletRefMap = {};
}

export {
  type RefImpl,
  createWorkletRef,
  initWorkletRef,
  getFromWorkletRefMap,
  removeValueFromWorkletRefMap,
  hydrateWorkletValue,
  updateWorkletRefInitValueChanges,
  isHydratedWorkletValue,
};
