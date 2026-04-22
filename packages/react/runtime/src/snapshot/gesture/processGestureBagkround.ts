// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { GestureTypeInner } from './types.js';
import type { BaseGesture, ComposedGesture, GestureKind } from './types.js';
import { onPostWorkletCtx } from '../worklet/ctx.js';

export function processGestureBackground(gesture: GestureKind): void {
  if (gesture.type === GestureTypeInner.COMPOSED) {
    for (const subGesture of (gesture as ComposedGesture).gestures) {
      processGestureBackground(subGesture);
    }
  } else {
    const baseGesture = gesture as BaseGesture;
    for (const [name, value] of Object.entries(baseGesture.callbacks)) {
      baseGesture.callbacks[name] = onPostWorkletCtx(value)!;
    }
  }
}
