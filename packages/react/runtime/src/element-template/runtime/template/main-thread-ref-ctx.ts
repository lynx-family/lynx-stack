// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx, runWorkletCtx, updateWorkletRef } from '@lynx-js/react/worklet-runtime/bindings';
import type { Element, Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import {
  registerMainThreadBackgroundFunctionCtx,
  retainMainThreadBackgroundFunctionCtx,
} from './main-thread-background-function.js';
import { isMainThreadFunction } from '../../../core/main-thread-function.js';
import { isMainThreadRef } from '../../../core/main-thread-ref.js';
import type { SerializableValue } from '../../protocol/types.js';

export type MTRefValue = WorkletRefImpl<Element> | Worklet;

export interface MTRefNativeWrapper {
  type: 'main-thread-ref';
  value: MTRefValue;
}

export function isMTRefValue(value: unknown): value is MTRefValue {
  return isMainThreadRef(value) || isMainThreadFunction(value);
}

export function retainMTRefValue(value: MTRefValue): void {
  if (isMainThreadFunction(value)) {
    retainMainThreadBackgroundFunctionCtx(value);
  }
}

export function hydrateMTRefValue(
  value: MTRefValue,
  previousValue: MTRefValue | undefined,
): void {
  if (isMainThreadFunction(value) && previousValue && isMainThreadFunction(previousValue)) {
    hydrateWorkletCtx(value, previousValue);
  }
}

export function attachMTRefValue(
  value: MTRefValue,
  nativeRef: ElementRef,
): void {
  if (isMainThreadRef(value)) {
    updateWorkletRef(value, nativeRef as ElementNode);
    return;
  }
  value._unmount = runWorkletCtx(
    value,
    [{ elementRefptr: nativeRef }] as unknown as Parameters<typeof runWorkletCtx>[1],
  ) as () => void;
}

export function cleanupMTRefValue(value: MTRefValue): void {
  if (isMainThreadRef(value)) {
    updateWorkletRef(value, null);
    return;
  }
  if (typeof value._unmount === 'function') {
    value._unmount();
    return;
  }
  runWorkletCtx(value, [null]);
}

export function prepareMTRefForNative(
  rawValue: unknown,
  previousPreparedValue?: unknown,
  previousRawValue?: unknown,
): SerializableValue | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if (!isMTRefValue(rawValue)) {
    throw new Error('ElementTemplate main-thread:ref expects a MainThreadRef object or a main-thread function.');
  }
  if (previousRawValue === rawValue) {
    return previousPreparedValue as SerializableValue;
  }

  let value: MTRefValue;
  if (isMainThreadFunction(rawValue)) {
    value = { ...rawValue };
    registerMainThreadBackgroundFunctionCtx(value);
  } else {
    value = rawValue;
  }

  return {
    type: 'main-thread-ref',
    value,
  } as unknown as SerializableValue;
}
