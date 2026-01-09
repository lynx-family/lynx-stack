// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThreadRef } from '@lynx-js/react';

import '../polyfill/shim.js';

import { useMotionValueRefEvent as useMotionValueRefEvent_ } from '../hooks/useMotionEvent.js';
import { useMotionValueRefCore } from '../hooks/useMotionValueRef.js';
import { createMotionValue } from './core/MotionValue.js';
import type {
  MotionValue,
  MotionValueEventCallbacks,
} from './core/MotionValue.js';

export {
  animate,
  anticipate,
  backIn,
  backInOut,
  backOut,
  circIn,
  circInOut,
  circOut,
  easeIn,
  easeInOut,
  easeOut,
  linear,
} from './core/animate.js';
export type { AnimationOptions, Easing } from './core/animate.js';
export { createMotionValue } from './core/MotionValue.js';
export type {
  MotionValue,
  MotionValueEventCallbacks,
} from './core/MotionValue.js';
export { spring } from './core/spring.js';

export function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>> {
  return useMotionValueRefCore(value, createMotionValue);
}

export function useMotionValueRefEvent<
  V,
  EventName extends keyof MotionValueEventCallbacks<V>,
>(
  valueRef: MainThreadRef<MotionValue<V>>,
  event: 'change',
  callback: MotionValueEventCallbacks<V>[EventName],
): void {
  return useMotionValueRefEvent_(valueRef, event, callback);
}
