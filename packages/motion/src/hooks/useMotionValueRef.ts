// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MotionValue } from 'motion-dom';

import type { MainThreadRef } from '@lynx-js/react';

import { useMotionValueRefCore } from './useMotionValueRefCore.js';
import { motionValue } from '../animation/index.js';

export { useMotionValueRefCore };

/**
 * @experimental useMotionValue, but in MainThreadRef format, highly experimental, subject to change
 */
export function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>> {
  return useMotionValueRefCore(value, motionValue);
}
