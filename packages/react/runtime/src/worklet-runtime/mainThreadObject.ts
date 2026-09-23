// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet, WorkletRefImpl } from './bindings/types.js';

type MainThreadObjectFactory = (initialValue: unknown) => object;
interface MainThreadObjectDefinition {
  create: MainThreadObjectFactory | Worklet;
  resolvedCreate?: MainThreadObjectFactory;
}

const mainThreadObjectDefinitions = new Map<string, MainThreadObjectDefinition>();
// The brand belongs to the target, not an individual handle. Other handles or
// captured contexts may still own the target after one ref-map entry is removed.
let realizedMainThreadObjectTypes = new WeakMap<object, string>();

function registerMainThreadObjectType(
  type: string,
  create: MainThreadObjectFactory | Worklet,
): void {
  if (type === 'main-thread') {
    throw new Error(
      'MainThreadObject type "main-thread" is reserved for MainThreadRef.',
    );
  }
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
  if (!('_wkltId' in factory) || '_lepusWorkletHash' in factory) {
    throw new Error('Cannot resolve an invalid Main Thread Function.');
  }
  // Factories are capture-free, so they need neither context traversal nor binding.
  // Resolve on first use: the compiler registers worklets after module evaluation.
  return lynxWorkletImpl._workletMap[factory._wkltId] as MainThreadObjectFactory;
}

function getMainThreadObjectFactory(
  definition: MainThreadObjectDefinition,
): MainThreadObjectFactory {
  return definition.resolvedCreate ??= resolveFactoryFunction(definition.create);
}

function createMainThreadObject(refImpl: WorkletRefImpl<unknown>): object {
  const type = refImpl._type!;
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
  return value;
}

function isRealizedMainThreadObject(value: object): boolean {
  return realizedMainThreadObjectTypes.has(value);
}

function assertCompatibleMainThreadObject(
  handle: WorkletRefImpl<unknown>,
  value: object,
  operation: 'hydration' | 'initialization patch',
): void {
  const actualType = realizedMainThreadObjectTypes.get(value);
  const expectedType = handle._type!;
  if (actualType !== expectedType) {
    throw new Error(
      `MainThreadObject type mismatch during ${operation} for handle ${handle._wvid}: background handle expects type "${expectedType}", but the main-thread target is type "${actualType}".`,
    );
  }
}

function initMainThreadObjects(): void {
  mainThreadObjectDefinitions.clear();
  realizedMainThreadObjectTypes = new WeakMap();
}

export {
  type MainThreadObjectFactory,
  initMainThreadObjects,
  registerMainThreadObjectType,
  createMainThreadObject,
  assertCompatibleMainThreadObject,
  isRealizedMainThreadObject,
};
