// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext, onRootContextSwitch } from '../../../render-context.js';
import type { LifecycleConstant } from '../../lifecycle/constant.js';

let delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = getCurrentRootContext().delayedLifecycleEvents;

onRootContextSwitch(() => {
  delayedLifecycleEvents = getCurrentRootContext().delayedLifecycleEvents;
});

function delayLifecycleEvent(type: LifecycleConstant, data: unknown): void {
  getCurrentRootContext().delayedLifecycleEvents.push([type, data]);
}

/**
 * @internal
 */
export { delayedLifecycleEvents, delayLifecycleEvent };
