// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Element, Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { registerMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
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
