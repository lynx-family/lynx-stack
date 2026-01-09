// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BaseGesture } from './baseGesture.js';
import type {
  TapGestureChangeEvent,
  TapGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';
import { DEFAULT_DISTANCE, DEFAULT_LONGPRESS_DURATION } from './utils/const.js';

class TapGesture extends BaseGesture<TapGestureConfig, TapGestureChangeEvent> {
  type: GestureTypeInner = GestureTypeInner.TAP;
  override config: TapGestureConfig = {
    enabled: true,
    maxDuration: DEFAULT_LONGPRESS_DURATION,
    maxDistance: DEFAULT_DISTANCE,
  };

  maxDuration = (duration: number): this => {
    return this.updateConfig('maxDuration', duration);
  };

  maxDistance = (distance: number): this => {
    return this.updateConfig('maxDistance', distance);
  };

  numberOfTaps = (count: number): this => {
    return this.updateConfig('numberOfTaps', count);
  };
}

export { TapGesture };
