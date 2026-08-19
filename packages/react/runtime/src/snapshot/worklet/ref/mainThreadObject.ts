// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  WorkletEvents,
  loadWorkletRuntime,
  registerMainThreadObjectType,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { allocateWorkletValueId } from './workletValueId.js';
import { useMemo } from '../../../core/hooks/react.js';
import { addMainThreadRefInitValue } from '../../../core/main-thread-ref-init-value.js';

/** @internal */
export const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

const mainThreadObjectHandles = new WeakSet<object>();
const mainThreadObjectHandleTypes = new WeakMap<object, string>();
const mainThreadObjectTypeDefinitions = new WeakMap<
  object,
  MainThreadObjectTypeDefinition<unknown, object>
>();

/**
 * Describes how a serializable initialization payload becomes a stable object
 * in the main-thread runtime.
 *
 * @public
 */
export interface MainThreadObjectTypeDefinition<I, O extends object> {
  /** A globally unique and stable type key. */
  readonly type: string;
  /**
   * Create the realized main-thread object.
   *
   * This must be a capture-free Main Thread Function. Imports used by the
   * function must come from shared-runtime modules.
   */
  readonly create: (initialValue: I) => O;
  /**
   * Dispose a realized object after its handle is released.
   *
   * This must be a capture-free Main Thread Function when provided.
   */
  readonly dispose?: (object: O) => void;
}

/**
 * An immutable MainThreadObject type token with source-handle downcasting.
 *
 * The lifecycle functions belong to the input definition and are not exposed
 * by the returned token. In the background runtime they compile to opaque
 * Main Thread Function descriptors rather than bundling their implementation.
 *
 * @public
 */
export interface MainThreadObjectType<I, O extends object> {
  /** A globally unique and stable type key. */
  readonly type: string;
  /**
   * Narrow a value to a source-runtime handle of this exact type.
   *
   * This does not create or access the realized main-thread object.
   */
  readonly downcast: (value: unknown) => MainThreadObjectHandle<I, O> | undefined;
}

/**
 * An opaque source-runtime handle for an object realized on the main thread.
 *
 * A handle has logical identity and is serializable, but it is not the target
 * object or an RPC stub. Capturing it in a main-thread function resolves it to
 * the corresponding local target object. Development builds may wrap the
 * background handle in a throwing guard solely to diagnose invalid access;
 * that guard never forwards operations between runtimes.
 *
 * @public
 */
export abstract class MainThreadObjectHandle<I, O extends object> {
  /** @internal */
  declare private readonly _mainThreadObjectTargetType: O;
  /** @internal */
  protected _wvid: number;
  /** @internal */
  protected _initValue: I;
  /** @internal */
  protected _type: string;
  /** @internal */
  protected _mtoVersion: number;
  /** @internal */
  protected _lifecycleObserver?: unknown;

  /** @internal */
  protected constructor(initialValue: I, type: string) {
    const payload = snapshotMainThreadObjectPayload(initialValue, type);

    this._wvid = allocateWorkletValueId();
    this._initValue = payload;
    this._type = type;
    this._mtoVersion = MAIN_THREAD_OBJECT_PROTOCOL_VERSION;
    mainThreadObjectHandles.add(this);
    mainThreadObjectHandleTypes.set(this, type);

    if (__JS__) {
      addMainThreadRefInitValue(
        this._wvid,
        payload,
        type,
        MAIN_THREAD_OBJECT_PROTOCOL_VERSION,
      );

      const id = this._wvid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseWorkletRef,
          data: { id },
        });
      });
    }
  }

  /** A deeply immutable snapshot of the payload used to create the realized object. */
  public get payload(): Readonly<I> {
    return this._initValue;
  }

  /** @internal */
  toJSON(): Pick<WorkletRefImpl<unknown>, '_wvid' | '_initValue' | '_type' | '_mtoVersion'> {
    return {
      _wvid: this._wvid,
      _initValue: this._initValue,
      _type: this._type,
      _mtoVersion: this._mtoVersion,
    };
  }
}

class MainThreadObjectHandleImpl<I, O extends object> extends MainThreadObjectHandle<I, O> {
  constructor(initialValue: I, type: string) {
    super(initialValue, type);
  }
}

/**
 * Define a main-thread object type for use by a library-provided hook.
 *
 * @param definition - Stable type key and target-object lifecycle functions.
 * @returns An immutable object type definition.
 * @public
 */
export function defineMainThreadObjectType<I, O extends object>(
  definition: MainThreadObjectTypeDefinition<I, O>,
): MainThreadObjectType<I, O> {
  if (typeof definition.type !== 'string' || definition.type.length === 0) {
    throw new Error('MainThreadObject type must be a non-empty string.');
  }
  if (!isMainThreadLifecycleFunction(definition.create)) {
    throw new Error(
      `MainThreadObject type "${definition.type}" must provide a create Main Thread Function.`,
    );
  }
  if (definition.dispose !== undefined && !isMainThreadLifecycleFunction(definition.dispose)) {
    throw new Error(
      `MainThreadObject type "${definition.type}" has an invalid dispose Main Thread Function.`,
    );
  }
  assertCaptureFreeLifecycleFunction(definition.type, 'create', definition.create);
  if (definition.dispose !== undefined) {
    assertCaptureFreeLifecycleFunction(definition.type, 'dispose', definition.dispose);
  }

  const type = definition.type;
  const objectType = Object.freeze({
    type,
    downcast(value: unknown): MainThreadObjectHandle<I, O> | undefined {
      return getMainThreadObjectHandleType(value) === type
        ? value as MainThreadObjectHandle<I, O>
        : undefined;
    },
  });
  mainThreadObjectTypeDefinitions.set(
    objectType,
    definition as unknown as MainThreadObjectTypeDefinition<unknown, object>,
  );
  registerMainThreadObjectDefinition(definition);
  return objectType;
}

/**
 * Create a stable handle that resolves to an object of the supplied type in
 * main-thread functions.
 *
 * This primitive is intended for library hooks. The returned target type is
 * only callable in a main-thread function; it must not be used from the
 * background runtime.
 *
 * @param objectType - Definition used to realize the target object.
 * @param initialValue - JSON-serializable initialization payload.
 * @returns The main-thread-only target type.
 * @public
 */
export function useMainThreadObject<I, O extends object>(
  objectType: MainThreadObjectType<I, O>,
  initialValue: I,
): O {
  return useMemo(() => {
    const definition = mainThreadObjectTypeDefinitions.get(objectType);
    if (definition === undefined) {
      throw new Error(
        `Invalid MainThreadObject type token for "${objectType.type}". Create it with defineMainThreadObjectType().`,
      );
    }
    // A library module normally registers its type while the MTS bundle is
    // evaluated. Register again at the first hook use so runtimes that retain
    // the module but reset their per-page worklet registry remain correct.
    // The registry treats an equivalent duplicate as an idempotent lookup.
    registerMainThreadObjectDefinition(definition);
    const handle = new MainThreadObjectHandleImpl<I, O>(initialValue, objectType.type);
    return guardBackgroundMainThreadObjectAccess(handle, objectType.type) as unknown as O;
  }, []);
}

/** @internal */
export function registerMainThreadObjectDefinition<I, O extends object>(
  definition: MainThreadObjectTypeDefinition<I, O>,
): void {
  if (__JS__) {
    return;
  }

  const schema = (globalThis as { globDynamicComponentEntry?: string })
    .globDynamicComponentEntry;
  loadWorkletRuntime(schema);
  registerMainThreadObjectType(
    definition.type,
    definition.create as ((initialValue: unknown) => object) | Worklet,
    definition.dispose as (((object: object) => void) | Worklet | undefined),
    MAIN_THREAD_OBJECT_PROTOCOL_VERSION,
  );
}

/** @internal */
export function isMainThreadObjectHandle(
  value: unknown,
): value is MainThreadObjectHandle<unknown, object> {
  return typeof value === 'object' && value !== null && mainThreadObjectHandles.has(value);
}

function getMainThreadObjectHandleType(
  value: unknown,
): string | undefined {
  return typeof value === 'object' && value !== null
    ? mainThreadObjectHandleTypes.get(value)
    : undefined;
}

function isMainThreadLifecycleFunction(
  value: unknown,
): value is ((...args: never[]) => unknown) | Worklet {
  return typeof value === 'function'
    || (typeof value === 'object' && value !== null
      && typeof (value as Partial<Worklet>)._wkltId === 'string');
}

function assertCaptureFreeLifecycleFunction(
  type: string,
  name: 'create' | 'dispose',
  value: ((...args: never[]) => unknown) | Worklet,
): void {
  if (typeof value === 'function') {
    return;
  }
  const hasCaptures = Object.keys(value).some(key => {
    if (key === '_wkltId' || key === '_workletType' || key === '_lepusWorkletHash') {
      return false;
    }
    if (key === '_c') {
      return value._c !== undefined
        && (typeof value._c !== 'object' || value._c === null
          || Object.keys(value._c).length !== 0);
    }
    return true;
  });
  if (hasCaptures) {
    throw new Error(
      `MainThreadObject ${name} function for "${type}" must not capture values. Import dependencies from a shared-runtime module instead.`,
    );
  }
}

function guardBackgroundMainThreadObjectAccess<I, O extends object>(
  handle: MainThreadObjectHandle<I, O>,
  type: string,
): MainThreadObjectHandle<I, O> {
  if (!__DEV__ || !__JS__) {
    return handle;
  }

  // This development-only guard never forwards a call to the main thread. It
  // only turns an otherwise opaque "method is not a function" failure into a
  // diagnostic. Production handles remain plain serializable objects.
  const guardedHandle = new Proxy(handle, {
    get(target, property, receiver): unknown {
      if (property in target) {
        return Reflect.get(target, property, receiver) as unknown;
      }
      throw new Error(
        `MainThreadObject handle for "${type}" cannot access "${
          String(property)
        }" in the background runtime. Use the object only inside a main-thread function.`,
      );
    },
    set(target, property, value, receiver) {
      if (property in target) {
        return Reflect.set(target, property, value, receiver);
      }
      throw new Error(
        `MainThreadObject handle for "${type}" cannot set "${
          String(property)
        }" in the background runtime. Use the object only inside a main-thread function.`,
      );
    },
  });
  mainThreadObjectHandles.add(guardedHandle);
  const handleType = mainThreadObjectHandleTypes.get(handle);
  if (handleType !== undefined) {
    mainThreadObjectHandleTypes.set(guardedHandle, handleType);
  }
  return guardedHandle;
}

type PayloadSnapshotResult =
  | { valid: true; value: unknown }
  | { valid: false; invalidPath: string };

function snapshotMainThreadObjectPayload<T>(value: T, type: string): T {
  const result = snapshotSerializableValue(value, '$', new Set<object>());
  if (!result.valid) {
    throw new Error(
      `MainThreadObject initial value for "${type}" must be JSON-serializable; invalid value at ${result.invalidPath}.`,
    );
  }
  return result.value as T;
}

function snapshotSerializableValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): PayloadSnapshotResult {
  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
    || (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return { valid: false, invalidPath: path };
  }
  if (value === null || typeof value !== 'object') {
    return { valid: true, value };
  }
  if (ancestors.has(value)) {
    return { valid: false, invalidPath: path };
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return { valid: false, invalidPath: path };
  }

  ancestors.add(value);
  let snapshot: unknown[] | Record<string, unknown>;
  if (Array.isArray(value)) {
    snapshot = [];
    snapshot.length = value.length;
  } else {
    snapshot = Object.create(prototype) as Record<string, unknown>;
  }
  const entries: [string, unknown][] = [];
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (Object.prototype.hasOwnProperty.call(value, index)) {
        entries.push([String(index), value[index]]);
      }
    }
  } else {
    entries.push(...Object.entries(value));
  }
  for (const [key, item] of entries) {
    const result = snapshotSerializableValue(item, `${path}.${key}`, ancestors);
    if (!result.valid) {
      ancestors.delete(value);
      return result;
    }
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: true,
      value: result.value,
      writable: false,
    });
  }
  ancestors.delete(value);
  return { valid: true, value: Object.freeze(snapshot) };
}
