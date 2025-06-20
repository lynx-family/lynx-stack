// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const delayedLifecycleEvents: [type: string, data: any][] = [];

function delayLifecycleEvent(type: string, data: any): void {
  delayedLifecycleEvents.push([type, data]);
}

/**
 * @internal
 */
export { delayLifecycleEvent, delayedLifecycleEvents };
