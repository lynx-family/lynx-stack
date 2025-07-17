// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LifecycleConstant } from '../../lifecycleConstant.js';

const delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = [];

function delayLifecycleEvent(type: LifecycleConstant, data: unknown): void {
  delayedLifecycleEvents.push([type, data]);
}

/**
 * @internal
 */
export { delayLifecycleEvent, delayedLifecycleEvents };
