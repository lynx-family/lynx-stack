// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ContinuousGesture } from './baseGesture.js';
import type {
  DefaultGestureChangeEvent,
  DefaultGestureConfig,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';

export class DefaultScrollGesture
  extends ContinuousGesture<DefaultGestureConfig, DefaultGestureChangeEvent>
{
  type: GestureTypeInner = GestureTypeInner.DEFAULT;

  override config: DefaultGestureConfig = {
    enabled: true,
    tapSlop: 3, // default tap slop
  };

  tapSlop = (tapSlop: number): this => {
    return this.updateConfig('tapSlop', tapSlop);
  };
}
