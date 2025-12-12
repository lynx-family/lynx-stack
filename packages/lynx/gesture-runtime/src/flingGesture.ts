// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ContinuousGesture } from './baseGesture.js';
import type {
  FlingGestureChangeEvent,
  FlingGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';

export interface FlingGestureChangeEventPayload {
  changeX: number;
  changeY: number;
}

class FlingGesture
  extends ContinuousGesture<FlingGestureConfig, FlingGestureChangeEvent>
{
  type: GestureTypeInner = GestureTypeInner.FLING;
}

export { FlingGesture };
