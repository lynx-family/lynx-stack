// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext } from '../../../root-context.js';
import type { LifecycleConstant } from '../../lifecycle/constant.js';

function getDelayedLifecycleEvents(): [type: LifecycleConstant, data: unknown][] {
  return getCurrentRootContext().delayedLifecycleEvents;
}

function delayLifecycleEvent(type: LifecycleConstant, data: unknown): void {
  getCurrentRootContext().delayedLifecycleEvents.push([type, data]);
}

export { delayLifecycleEvent, getDelayedLifecycleEvents };
