// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BaseGesture } from './baseGesture.js';
import type {
  LongPressGestureChangeEvent,
  LongPressGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';
import { DEFAULT_DISTANCE, DEFAULT_LONGPRESS_DURATION } from './utils/const.js';

class LongPressGesture
  extends BaseGesture<LongPressGestureConfig, LongPressGestureChangeEvent>
{
  override config: LongPressGestureConfig = {
    enabled: true,
    minDuration: DEFAULT_LONGPRESS_DURATION,
    maxDistance: DEFAULT_DISTANCE,
  };
  type: GestureTypeInner = GestureTypeInner.LONGPRESS;

  minDuration = (duration: number): this => {
    return this.updateConfig('minDuration', duration);
  };

  maxDistance = (distance: number): this => {
    return this.updateConfig('maxDistance', distance);
  };
}

export { LongPressGesture };
