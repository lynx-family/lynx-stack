// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { registerContextSlot } from '../../../root-context.js';
import type { LifecycleConstant } from '../../lifecycle/constant.js';

let delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = [];

function delayLifecycleEvent(type: LifecycleConstant, data: unknown): void {
  delayedLifecycleEvents.push([type, data]);
}

registerContextSlot({
  id: 'delayedLifecycleEvents',
  init: () => [],
  save(bag) {
    bag['delayedLifecycleEvents'] = delayedLifecycleEvents;
  },
  load(bag) {
    delayedLifecycleEvents = bag['delayedLifecycleEvents'] as typeof delayedLifecycleEvents;
  },
});

/**
 * @internal
 */
export { delayLifecycleEvent, delayedLifecycleEvents };
