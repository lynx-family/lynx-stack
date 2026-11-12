// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import {
  defineMainThreadObjectType,
  useMainThreadObject,
} from '@lynx-js/react';

import { motionValue } from '../polyfill/MotionValue.js' with { runtime: 'shared' };

const MOTION_VALUE_TYPE = '@lynx-js/motion/MotionValue';
/** @internal */
export const motionValueType = defineMainThreadObjectType<
  unknown,
  MotionValue<unknown>
>({
  type: MOTION_VALUE_TYPE,
  create(initialValue) {
    'main thread';
    return motionValue(initialValue);
  },
});

/**
 * Create a Motion value that is retained on the main thread and can be used
 * directly inside main thread functions.
 *
 * @param initialValue - Initial value of the Motion value.
 * @public
 */
export function useMotionValue<T>(initialValue: T): MotionValue<T> {
  return useMainThreadObject(
    motionValueType,
    initialValue,
  ) as MotionValue<T>;
}
