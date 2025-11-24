// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MotionValue } from 'motion-dom';
import type { MotionValueOptions } from 'motion-dom';

class CustomMotionValue<V = any> extends MotionValue<V> {
  toJSON() {
    return {};
  }
}

export function motionValue<V>(
  init: V,
  options?: MotionValueOptions,
): MotionValue<V> {
  return new CustomMotionValue<V>(init, options);
}
