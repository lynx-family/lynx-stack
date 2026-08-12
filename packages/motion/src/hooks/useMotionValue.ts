// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import {
  defineMainThreadObjectType,
  runOnMainThread,
  useMainThreadObject,
} from '@lynx-js/react';

import { motionValue } from '../polyfill/MotionValue.js' with { runtime: 'shared' };

const MOTION_VALUE_TYPE = '@lynx-js/motion/MotionValue';

function setMotionValue(
  handle: MotionValue<unknown>,
  value: unknown,
  render?: boolean,
) {
  'main thread';
  handle.set(value, render);
}

const MotionValueType = defineMainThreadObjectType<
  unknown,
  MotionValue<unknown>
>({
  type: MOTION_VALUE_TYPE,
  create: motionValue,
  dispose: value => value.stop(),
  backgroundMethods: handle => ({
    set(value: unknown, render?: boolean) {
      void runOnMainThread(setMotionValue)(handle, value, render);
    },
  }),
});
const motionValueHandleInitialValues = new WeakMap<object, unknown>();

/**
 * Create a Motion value that is retained on the main thread and can be used
 * directly inside main thread functions. `set()` may also be called from the
 * background runtime and is dispatched asynchronously to the main thread.
 *
 * @param initialValue - Initial value of the Motion value.
 * @public
 */
export function useMotionValue<T>(initialValue: T): MotionValue<T> {
  const value = useMainThreadObject(
    MotionValueType,
    initialValue,
  ) as MotionValue<T>;
  motionValueHandleInitialValues.set(value, initialValue);
  return value;
}

/** @internal */
export function isMotionValueHandle(
  value: unknown,
): value is MotionValue<unknown> {
  return typeof value === 'object'
    && value !== null
    && motionValueHandleInitialValues.has(value);
}

/** @internal */
export function getMotionValueHandleInitialValue(
  value: MotionValue<unknown>,
): unknown {
  return motionValueHandleInitialValues.get(value);
}
