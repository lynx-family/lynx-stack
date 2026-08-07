// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import { MainThreadValue, useMemo } from '@lynx-js/react';

import { motionValue } from '../polyfill/MotionValue.js' with { runtime: 'shared' };

const MOTION_VALUE_TYPE = '@lynx-js/motion/MotionValue';

class MotionValueHandle<T> extends MainThreadValue<T> {
  constructor(initialValue: T) {
    super(initialValue, MOTION_VALUE_TYPE);
  }
}

/**
 * Create a Motion value that is retained on the main thread and can be used
 * directly inside main thread functions.
 *
 * @param initialValue - Initial value of the Motion value.
 * @public
 */
export function useMotionValue<T>(initialValue: T): MotionValue<T> {
  return useMemo(() => {
    MainThreadValue.register(MOTION_VALUE_TYPE, motionValue);
    return new MotionValueHandle(initialValue) as unknown as MotionValue<T>;
  }, []);
}
