// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { takeDelayedRunOnMainThreadData } from './delayedRunOnMainThreadData.js';
import { takeWorkletRefInitValuePatch } from './workletRefPool.js';

export const destroyTasks: (() => void)[] = [];

export function destroyWorklet(): void {
  takeWorkletRefInitValuePatch();
  takeDelayedRunOnMainThreadData();

  for (const task of destroyTasks) {
    task();
  }
  destroyTasks.length = 0;
}
