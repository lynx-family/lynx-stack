// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export {
  animate,
  stagger,
  motionValue,
  spring,
  springValue,
  mix,
  progress,
  mapValue,
  clamp,
  transformValue,
  styleEffect,
  useMotionValueRefEvent,
} from './animation/index.js';

export { useMotionValueRef } from './hooks/useMotionValueRef.js';
export { useMotionValue } from './hooks/useMotionValue.js';
export { motion } from './declarative/motion.js';

export type { MotionValue } from 'motion-dom';
export type {
  MotionComponentProps,
  MotionDefinition,
  MotionFactory,
  MotionImageProps,
  MotionProps,
  MotionStyle,
  MotionStyleValue,
  MotionTapInfo,
  MotionTarget,
  MotionTextProps,
  MotionTransition,
  MotionVariants,
  MotionViewProps,
} from './declarative/types.js';
