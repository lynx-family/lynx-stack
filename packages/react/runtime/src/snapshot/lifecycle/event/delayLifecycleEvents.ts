// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LifecycleConstant } from '../../lifecycle/constant.js';

let delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = [];

function delayLifecycleEvent(type: LifecycleConstant, data: unknown): void {
  delayedLifecycleEvents.push([type, data]);
}

function setDelayedLifecycleEvents(events: typeof delayedLifecycleEvents): void {
  delayedLifecycleEvents = events;
}

/**
 * @internal
 */
export { delayedLifecycleEvents, delayLifecycleEvent, setDelayedLifecycleEvents };
