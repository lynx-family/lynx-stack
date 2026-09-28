// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext, onRootContextSwitch } from '../../../render-context.js';

let delayedEvents: [handlerName: string, data: EventDataType][] = getCurrentRootContext().delayedEvents;

onRootContextSwitch(() => {
  delayedEvents = getCurrentRootContext().delayedEvents;
});

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  getCurrentRootContext().delayedEvents.push([handlerName, data]);
}

export { delayedEvents, delayedPublishEvent };
