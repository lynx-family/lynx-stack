// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onRootContextSwitch } from '../../../render-context.js';

let delayedEvents: [handlerName: string, data: EventDataType][] | undefined;

if (typeof __LYNX_GROUP_MODULE_SHARING__ !== 'undefined' && __LYNX_GROUP_MODULE_SHARING__) {
  onRootContextSwitch(
    (ctx) => ctx.delayedEvents = delayedEvents,
    (ctx) => delayedEvents = ctx.delayedEvents,
  );
}

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  delayedEvents ??= [];
  delayedEvents.push([handlerName, data]);
}

export { delayedPublishEvent, delayedEvents };
