// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Built separately so runtime substitution also covers transitive dependencies.
export { animate, clamp, progress, stagger } from 'motion';
export {
  mapValue,
  mix,
  MotionValue,
  motionValue,
  spring,
  springValue,
  styleEffect,
  transformValue,
} from 'motion-dom';
