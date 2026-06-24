// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { takeWorkletRefInitValuePatch } from './ref/workletRefPool.js';
import { runDestroyTasks } from '../../core/runtime-destroy.js';

export function destroyWorklet(): void {
  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    takeWorkletRefInitValuePatch();
  }

  runDestroyTasks();
}
