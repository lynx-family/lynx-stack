// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ContinuousGesture } from './baseGesture.js';
import type {
  NativeGestureChangeEvent,
  NativeGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';

/**
 * @experimental Currently highly experimental and subject to change.
 * NativeGesture is a gesture that represents native platform gestures.
 * It can be used to integrate with native gesture handling mechanisms.
 */
class NativeGesture
  extends ContinuousGesture<NativeGestureConfig, NativeGestureChangeEvent>
{
  type: GestureTypeInner = GestureTypeInner.NATIVE;
}

export { NativeGesture };
