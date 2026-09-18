// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerMainThreadBackgroundFunctionCtx } from './main-thread-background-function.js';
import { isMainThreadFunction } from '../../../core/main-thread-function.js';
import type { SerializableValue } from '../../protocol/types.js';

export interface MTEventCtx {
  _c?: Record<string, unknown>;
  _execId?: number;
  _jsFn?: Record<string, unknown>;
  _wkltId: string;
  [key: string]: unknown;
}

export interface MTEventNativeWrapper {
  type: 'worklet';
  value: MTEventCtx;
}

export function isMTEventNativeWrapper(value: unknown): value is MTEventNativeWrapper {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { type?: unknown }).type === 'worklet'
    && isMainThreadFunction((value as { value?: unknown }).value);
}

export function prepareMTEventCtxForNative(
  rawCtx: MTEventCtx,
  previousPreparedValue?: unknown,
  previousRawValue?: unknown,
): SerializableValue {
  if (previousRawValue === rawCtx) {
    return previousPreparedValue as SerializableValue;
  }

  const preparedCtx = { ...rawCtx };
  registerMainThreadBackgroundFunctionCtx(preparedCtx);

  return {
    type: 'worklet',
    value: preparedCtx,
  } as unknown as SerializableValue;
}
