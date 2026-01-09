// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { MotionValue } from 'motion-dom';

/**
 * Prevents excessive cross-thread communication.
 *
 * This override avoids unnecessary synchronization between the Main and Background
 * threads, as the Main Thread serves as the single source of truth.
 */

// @ts-expect-error expected
MotionValue.prototype.toJSON = function() {
  return {};
};

export { motionValue } from 'motion-dom';
