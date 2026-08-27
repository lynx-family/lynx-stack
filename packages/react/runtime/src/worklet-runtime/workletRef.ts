// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Element } from './api/element.js';
import type { Worklet, WorkletRef, WorkletRefId, WorkletRefImpl } from './bindings/types.js';
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
  registerMainThreadObjectType?(
    type: string,
    create: MainThreadObjectFactory | Worklet,
    dispose: MainThreadObjectDisposer | Worklet | undefined,
    protocolVersion: number,
  ): void;
  clearFirstScreenWorkletRefMap(): void;
}

let impl: RefImpl | undefined;
const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

type MainThreadObjectFactory = (initialValue: unknown) => object;
type MainThreadObjectDisposer = (object: object) => void;
interface MainThreadObjectDefinition {
  create: MainThreadObjectFactory | Worklet;
  dispose: MainThreadObjectDisposer | Worklet | undefined;
  resolvedCreate?: MainThreadObjectFactory;
  resolvedDispose?: MainThreadObjectDisposer;
}

const mainThreadObjectDefinitions = new Map<string, MainThreadObjectDefinition>();
interface MainThreadObjectMetadata {
  readonly type: string;
  readonly protocolVersion: number;
  readonly definition: MainThreadObjectDefinition;
}
let realizedMainThreadObjectMetadata = new WeakMap<object, MainThreadObjectMetadata>();
let firstScreenMainThreadObjects = new Set<object>();

function initWorkletRef(): RefImpl {
  if (__MAIN_THREAD_OBJECT__) {
    mainThreadObjectDefinitions.clear();
    realizedMainThreadObjectMetadata = new WeakMap();
    firstScreenMainThreadObjects = new Set();
  }
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
    /* v8 ignore next -- false branch is exercised by the separately built core runtime */
    ...(__MAIN_THREAD_OBJECT__ ? { registerMainThreadObjectType } : {}),
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

function registerMainThreadObjectType(
  type: string,
  create: MainThreadObjectFactory | Worklet,
  dispose: MainThreadObjectDisposer | Worklet | undefined,
  protocolVersion: number,
): void {
  assertMainThreadObjectProtocolVersion(type, protocolVersion);
  const registered = mainThreadObjectDefinitions.get(type);
  if (registered) {
    if (
      getLifecycleRegistrationIdentity(registered.create)
        !== getLifecycleRegistrationIdentity(create)
      || getLifecycleRegistrationIdentity(registered.dispose)
        !== getLifecycleRegistrationIdentity(dispose)
    ) {
      throw new Error(
        `Conflicting MainThreadObject registration for type "${type}". A type key must always use the same create and dispose functions.`,
      );
    }
    return;
  }
  mainThreadObjectDefinitions.set(type, { create, dispose });
}

function getLifecycleRegistrationIdentity(
  lifecycle: MainThreadObjectFactory | MainThreadObjectDisposer | Worklet | undefined,
): string | undefined {
  if (lifecycle === undefined) {
    return undefined;
  }
  if (typeof lifecycle === 'function') {
    return Function.prototype.toString.call(lifecycle);
  }
  return `worklet:${lifecycle._wkltId}`;
}

function resolveLifecycleFunction<T extends MainThreadObjectFactory | MainThreadObjectDisposer>(
  lifecycle: T | Worklet,
): T {
  if (typeof lifecycle === 'function') {
    return lifecycle;
  }
  const resolveWorklet = globalThis.lynxWorkletImpl?._resolveWorklet;
  if (typeof resolveWorklet !== 'function') {
    throw new Error(
      'MainThreadObject lifecycle functions require a newer ReactLynx main-thread runtime. Rebuild the main template with a compatible @lynx-js/react version.',
    );
  }
  return resolveWorklet(lifecycle) as T;
}

function getMainThreadObjectFactory(
  definition: MainThreadObjectDefinition,
): MainThreadObjectFactory {
  return definition.resolvedCreate ??= resolveLifecycleFunction(definition.create);
}

function getMainThreadObjectDisposer(
  definition: MainThreadObjectDefinition,
): MainThreadObjectDisposer | undefined {
  if (definition.dispose === undefined) {
    return undefined;
  }
  return definition.resolvedDispose ??= resolveLifecycleFunction(definition.dispose);
}

function createWorkletValue<T>(refImpl: WorkletRefImpl<T>): WorkletRef<T> {
  /* v8 ignore next 3 -- exercised by the separately built core runtime */
  if (!__MAIN_THREAD_OBJECT__) {
    return createWorkletRef(refImpl._wvid, refImpl._initValue);
  }
  const type = refImpl._type;
  if (!type || type === 'main-thread') {
    return createWorkletRef(refImpl._wvid, refImpl._initValue);
  }

  assertMainThreadObjectProtocolVersion(type, refImpl._mtoVersion);
  const definition = mainThreadObjectDefinitions.get(type);
  if (!definition) {
    throw new Error(
      `MainThreadObject type is not registered: "${type}". Define the type in a module evaluated on the main thread before initializing its handle.`,
    );
  }

  const value = getMainThreadObjectFactory(definition)(refImpl._initValue);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`MainThreadObject type "${type}" created a non-object value.`);
  }
  realizedMainThreadObjectMetadata.set(value, {
    type,
    protocolVersion: refImpl._mtoVersion!,
    definition,
  });
  if (refImpl._wvid < 0) {
    firstScreenMainThreadObjects.add(value);
  }
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
  return isMutableCell(value)
    || (__MAIN_THREAD_OBJECT__ && typeof value === 'object' && value !== null
      && realizedMainThreadObjectMetadata.has(value));
}

function isMutableCell(value: unknown): value is WorkletRef<unknown> {
  return typeof value === 'object' && value !== null
    && typeof (value as Partial<WorkletRef<unknown>>)._wvid === 'number'
    && Object.prototype.hasOwnProperty.call(value, 'current');
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
  if (__MAIN_THREAD_OBJECT__) {
    try {
      disposeMainThreadObject(impl!._workletRefMap[id]);
    } finally {
      delete impl!._workletRefMap[id];
    }
    /* v8 ignore start -- exercised by the separately built core runtime */
  } else {
    delete impl!._workletRefMap[id];
  }
  /* v8 ignore stop */
}

function hydrateWorkletValue(
  handle: WorkletRefImpl<unknown>,
  value: WorkletRef<unknown>,
): void {
  /* v8 ignore next 4 -- exercised by the separately built core runtime */
  if (!__MAIN_THREAD_OBJECT__) {
    impl!._workletRefMap[handle._wvid] = value;
    return;
  }
  assertCompatibleWorkletValue(handle, value, 'hydration');
  const previous = impl!._workletRefMap[handle._wvid];
  if (previous !== value) {
    disposeMainThreadObject(previous);
  }
  impl!._workletRefMap[handle._wvid] = value;
  firstScreenMainThreadObjects.delete(value);
}

function assertCompatibleWorkletValue(
  handle: WorkletRefImpl<unknown>,
  value: object,
  operation: 'hydration' | 'initialization patch',
): void {
  const actualMainThreadObject = realizedMainThreadObjectMetadata.get(value);
  let actualKind: 'typed-object' | 'mutable-cell' | undefined;
  if (actualMainThreadObject) {
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
  if (actualKind === 'mutable-cell') {
    return;
  }

  assertMainThreadObjectProtocolVersion(expectedType!, handle._mtoVersion);
  if (
    actualMainThreadObject!.type !== expectedType
    || actualMainThreadObject!.protocolVersion !== handle._mtoVersion
  ) {
    throw new Error(
      `MainThreadObject type mismatch during ${operation} for handle ${handle._wvid}: background handle expects type "${expectedType}" with protocol ${
        String(handle._mtoVersion)
      }, but the main-thread target is type "${actualMainThreadObject!.type}" with protocol ${
        actualMainThreadObject!.protocolVersion
      }.`,
    );
  }
}

function disposeMainThreadObject(value: unknown): void {
  if (isMutableCell(value) || typeof value !== 'object' || value === null) {
    return;
  }
  const metadata = realizedMainThreadObjectMetadata.get(value);
  if (!metadata) {
    return;
  }
  firstScreenMainThreadObjects.delete(value);
  realizedMainThreadObjectMetadata.delete(value);
  getMainThreadObjectDisposer(metadata.definition)?.(value);
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
      const handle = {
        _wvid: id,
        _initValue: value,
        _type: type,
        _mtoVersion: protocolVersion,
      } as WorkletRefImpl<unknown>;
      const existing = impl!._workletRefMap[id];
      if (existing) {
        if (__MAIN_THREAD_OBJECT__) {
          assertCompatibleWorkletValue(
            handle,
            existing,
            'initialization patch',
          );
        }
      } else {
        impl!._workletRefMap[id] = createWorkletValue(handle);
      }
    });
  });
}

function clearFirstScreenWorkletRefMap(): void {
  /* v8 ignore next 4 -- exercised by the separately built core runtime */
  if (!__MAIN_THREAD_OBJECT__) {
    impl!._firstScreenWorkletRefMap = {};
    return;
  }
  let firstError: unknown;
  let hasError = false;
  try {
    firstScreenMainThreadObjects.forEach(value => {
      try {
        disposeMainThreadObject(value);
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    });
  } finally {
    firstScreenMainThreadObjects.clear();
    impl!._firstScreenWorkletRefMap = {};
  }
  if (hasError) {
    throw firstError;
  }
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
