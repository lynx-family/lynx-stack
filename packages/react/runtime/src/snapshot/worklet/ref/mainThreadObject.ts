// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  WorkletEvents,
  loadWorkletRuntime,
  registerMainThreadObjectType,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { addWorkletRefInitValue } from './workletRefPool.js';
import { allocateWorkletValueId } from './workletValueId.js';
import { useMemo } from '../../../core/hooks/react.js';

/** @internal */
export const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

const mainThreadObjectHandles = new WeakSet<object>();
const mainThreadObjectHandleMetadata = new WeakMap<
  object,
  { readonly initialValue: unknown; readonly type: string }
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
  /** Create the realized main-thread object. */
  readonly create: (initialValue: I) => O;
  /** Dispose a realized object after its handle is released. */
  readonly dispose?: (object: O) => void;
}

/**
 * A main-thread object definition with type-scoped source-handle inspection.
 *
 * Handle inspection is intended for library adapters that need the
 * initialization payload while producing background-rendered output. It does
 * not expose the handle wire representation or the realized main-thread
 * object.
 *
 * @public
 */
export interface MainThreadObjectType<I, O extends object> extends MainThreadObjectTypeDefinition<I, O> {
  /** Return whether a value is a source-runtime handle of this exact type. */
  readonly isHandle: (value: unknown) => value is O;
  /** Read this type's initialization payload from one of its source handles. */
  readonly getInitialPayload: (value: O) => I;
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
export abstract class MainThreadObjectHandle<O extends object> {
  /** @internal */
  declare private readonly _mainThreadObjectTargetType: O;
  /** @internal */
  protected _wvid: number;
  /** @internal */
  protected _initValue: unknown;
  /** @internal */
  protected _type: string;
  /** @internal */
  protected _mtoVersion: number;
  /** @internal */
  protected _lifecycleObserver?: unknown;

  /** @internal */
  protected constructor(initialValue: unknown, type: string) {
    if (__DEV__ && __JS__) {
      assertSerializableMainThreadObjectPayload(initialValue, type);
    }

    this._wvid = allocateWorkletValueId();
    this._initValue = initialValue;
    this._type = type;
    this._mtoVersion = MAIN_THREAD_OBJECT_PROTOCOL_VERSION;
    mainThreadObjectHandles.add(this);
    mainThreadObjectHandleMetadata.set(this, { initialValue, type });

    if (__JS__) {
      addWorkletRefInitValue(
        this._wvid,
        initialValue,
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

class MainThreadObjectHandleImpl<I, O extends object> extends MainThreadObjectHandle<O> {
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
  if (typeof definition.create !== 'function') {
    throw new Error(`MainThreadObject type "${definition.type}" must provide a create function.`);
  }
  if (definition.dispose !== undefined && typeof definition.dispose !== 'function') {
    throw new Error(`MainThreadObject type "${definition.type}" has an invalid dispose function.`);
  }

  const type = definition.type;
  return Object.freeze({
    ...definition,
    isHandle(value: unknown): value is O {
      return getMainThreadObjectHandleMetadata(value)?.type === type;
    },
    getInitialPayload(value: O): I {
      const metadata = getMainThreadObjectHandleMetadata(value);
      if (metadata?.type !== type) {
        throw new Error(
          `Value is not a MainThreadObject handle for type "${type}".`,
        );
      }
      return metadata.initialValue as I;
    },
  });
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
  registerMainThreadObjectDefinition(objectType);
  return useMemo(() => {
    const handle = new MainThreadObjectHandleImpl<I, O>(initialValue, objectType.type);
    return guardBackgroundMainThreadObjectAccess(handle, objectType.type) as unknown as O;
  }, []);
}

/** @internal */
export function registerMainThreadObjectDefinition<I, O extends object>(
  objectType: MainThreadObjectTypeDefinition<I, O>,
): void {
  if (__JS__) {
    return;
  }

  const schema = (globalThis as { globDynamicComponentEntry?: string })
    .globDynamicComponentEntry;
  loadWorkletRuntime(schema);
  registerMainThreadObjectType(
    objectType.type,
    objectType.create as (initialValue: unknown) => object,
    objectType.dispose as ((object: object) => void) | undefined,
    MAIN_THREAD_OBJECT_PROTOCOL_VERSION,
  );
}

/** @internal */
export function isMainThreadObjectHandle(value: unknown): value is MainThreadObjectHandle<object> {
  return typeof value === 'object' && value !== null && mainThreadObjectHandles.has(value);
}

function getMainThreadObjectHandleMetadata(
  value: unknown,
): { readonly initialValue: unknown; readonly type: string } | undefined {
  return typeof value === 'object' && value !== null
    ? mainThreadObjectHandleMetadata.get(value)
    : undefined;
}

function guardBackgroundMainThreadObjectAccess<O extends object>(
  handle: MainThreadObjectHandle<O>,
  type: string,
): MainThreadObjectHandle<O> {
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
  const metadata = mainThreadObjectHandleMetadata.get(handle);
  if (metadata) {
    mainThreadObjectHandleMetadata.set(guardedHandle, metadata);
  }
  return guardedHandle;
}

function assertSerializableMainThreadObjectPayload(value: unknown, type: string): void {
  const invalidPath = findNonSerializablePath(value, '$', new Set<object>());
  if (invalidPath !== undefined) {
    throw new Error(
      `MainThreadObject initial value for "${type}" must be JSON-serializable; invalid value at ${invalidPath}.`,
    );
  }
}

function findNonSerializablePath(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): string | undefined {
  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
    || (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return path;
  }
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  if (ancestors.has(value)) {
    return path;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return path;
  }

  ancestors.add(value);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  for (const [key, item] of entries) {
    const invalidPath = findNonSerializablePath(item, `${path}.${key}`, ancestors);
    if (invalidPath !== undefined) {
      ancestors.delete(value);
      return invalidPath;
    }
  }
  ancestors.delete(value);
  return undefined;
}
