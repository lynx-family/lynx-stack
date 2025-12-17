// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BaseGesture } from './baseGesture.js';
import {
  ComposedGesture,
  ExclusiveGesture,
  RaceGesture,
  SimultaneousGesture,
} from './composition.js';
import { DefaultScrollGesture } from './defaultScrollGesture.js';
import { FlingGesture } from './flingGesture.js';
import type { GestureKind } from './gestureInterface.js';
import { LongPressGesture } from './longPressGesture.js';
import { PanGesture } from './panGesture.js';
import { TapGesture } from './tapGesture.js';
import { useGesture } from './useGesture.js';

const GestureEntry = {
  Simultaneous(...gestures: GestureKind[]): GestureKind {
    return new SimultaneousGesture(...gestures);
  },

  Race(...gestures: GestureKind[]): GestureKind {
    return new RaceGesture(...gestures);
  },

  Exclusive(...gestures: GestureKind[]): GestureKind {
    return new ExclusiveGesture(...gestures);
  },
};

export { GestureEntry as Gesture };
export * from './gestureInterface.js';
export {
  BaseGesture,
  SimultaneousGesture,
  ComposedGesture,
  ExclusiveGesture,
  DefaultScrollGesture,
  FlingGesture,
  PanGesture,
  TapGesture,
  LongPressGesture,
};

export { useGesture };
