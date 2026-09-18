// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet, WorkletRef, WorkletRefImpl } from './bindings/types.js';

const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

type MainThreadObjectFactory = (initialValue: unknown) => object;
interface MainThreadObjectDefinition {
  create: MainThreadObjectFactory | Worklet;
  resolvedCreate?: MainThreadObjectFactory;
}

const mainThreadObjectDefinitions = new Map<string, MainThreadObjectDefinition>();
let realizedMainThreadObjectTypes = new WeakMap<object, string>();
let firstScreenMainThreadObjects = new Set<object>();

function registerMainThreadObjectType(
  type: string,
  create: MainThreadObjectFactory | Worklet,
  protocolVersion: number,
): void {
  if (type === 'main-thread') {
    throw new Error(
      'MainThreadObject type "main-thread" is reserved for MainThreadRef.',
    );
  }
  assertMainThreadObjectProtocolVersion(type, protocolVersion);
  const registered = mainThreadObjectDefinitions.get(type);
  if (registered) {
    if (
      getFactoryRegistrationIdentity(registered.create)
        !== getFactoryRegistrationIdentity(create)
    ) {
      throw new Error(
        `Conflicting MainThreadObject registration for type "${type}". A type key must always use the same create function.`,
      );
    }
    return;
  }
  mainThreadObjectDefinitions.set(type, { create });
}

function getFactoryRegistrationIdentity(
  factory: MainThreadObjectFactory | Worklet,
): string {
  if (typeof factory === 'function') {
    return Function.prototype.toString.call(factory);
  }
  return `worklet:${factory._wkltId}`;
}

function resolveFactoryFunction(
  factory: MainThreadObjectFactory | Worklet,
): MainThreadObjectFactory {
  if (typeof factory === 'function') {
    return factory;
  }
  return resolveWorklet(factory) as MainThreadObjectFactory;
}

function getMainThreadObjectFactory(
  definition: MainThreadObjectDefinition,
): MainThreadObjectFactory {
  return definition.resolvedCreate ??= resolveFactoryFunction(definition.create);
}

function createMainThreadObject(refImpl: WorkletRefImpl<unknown>): object {
  const type = refImpl._type!;
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
  realizedMainThreadObjectTypes.set(value, type);
  if (refImpl._wvid < 0) {
    firstScreenMainThreadObjects.add(value);
  }
  return value;
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
  return typeof value === 'object' && value !== null
    && (realizedMainThreadObjectTypes.has(value) || isMutableCell(value));
}

function isRealizedMainThreadObject(value: object): boolean {
  return realizedMainThreadObjectTypes.has(value);
}

function isMutableCell(value: unknown): value is WorkletRef<unknown> {
  return typeof value === 'object' && value !== null
    && typeof (value as Partial<WorkletRef<unknown>>)._wvid === 'number'
    && Object.prototype.hasOwnProperty.call(value, 'current');
}

function assertCompatibleWorkletValue(
  handle: WorkletRefImpl<unknown>,
  value: object,
  operation: 'hydration' | 'initialization patch',
): void {
  const actualType = realizedMainThreadObjectTypes.get(value);
  let actualKind: 'typed-object' | 'mutable-cell' | undefined;
  if (actualType !== undefined) {
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
  if (actualType !== expectedType) {
    throw new Error(
      `MainThreadObject type mismatch during ${operation} for handle ${handle._wvid}: background handle expects type "${expectedType}" with protocol ${
        String(handle._mtoVersion)
      }, but the main-thread target is type "${actualType}" with protocol ${MAIN_THREAD_OBJECT_PROTOCOL_VERSION}.`,
    );
  }
}

function releaseMainThreadObject(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  if (!realizedMainThreadObjectTypes.has(value)) {
    return;
  }
  firstScreenMainThreadObjects.delete(value);
  realizedMainThreadObjectTypes.delete(value);
}

type WorkletResolver = (worklet: Worklet) => (...args: unknown[]) => unknown;
let resolveWorklet: WorkletResolver;

function initMainThreadObjects(resolver: WorkletResolver): void {
  resolveWorklet = resolver;
  mainThreadObjectDefinitions.clear();
  realizedMainThreadObjectTypes = new WeakMap();
  firstScreenMainThreadObjects = new Set();
}

function retainHydratedMainThreadObject(value: object): void {
  firstScreenMainThreadObjects.delete(value);
}

function clearFirstScreenMainThreadObjects(): void {
  firstScreenMainThreadObjects.forEach(value => releaseMainThreadObject(value));
  firstScreenMainThreadObjects.clear();
}

export {
  type MainThreadObjectFactory,
  type WorkletResolver,
  initMainThreadObjects,
  registerMainThreadObjectType,
  createMainThreadObject,
  assertCompatibleWorkletValue,
  isHydratedWorkletValue,
  isRealizedMainThreadObject,
  releaseMainThreadObject,
  retainHydratedMainThreadObject,
  clearFirstScreenMainThreadObjects,
};
