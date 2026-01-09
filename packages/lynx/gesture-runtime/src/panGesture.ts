// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ContinuousGesture } from './baseGesture.js';
import type {
  PanGestureChangeEvent,
  PanGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';
import { DEFAULT_DISTANCE, DEFAULT_PAN_DISTANCE } from './utils/const.js';

export interface PanGestureChangeEventPayload {
  changeX: number;
  changeY: number;
}

class PanGesture
  extends ContinuousGesture<PanGestureConfig, PanGestureChangeEvent>
{
  type: GestureTypeInner = GestureTypeInner.PAN;
  distanceSet = false;

  override config: PanGestureConfig = {
    enabled: true,
    minDistance: DEFAULT_PAN_DISTANCE,
  };

  minDistance = (distance: number): this => {
    // We need to know whether distance is set by user or it's default value
    // So that we can get to know override it or not
    if (distance === undefined) {
      this.distanceSet = false;
    } else {
      this.distanceSet = true;
    }
    return this.updateConfig('minDistance', distance);
  };

  overrideDefaultMinDistance = (): this => {
    if (this.distanceSet) {
      return this;
    } else {
      this.updateConfig('minDistance', DEFAULT_DISTANCE);
    }
    return this;
  };
}

export { PanGesture };
