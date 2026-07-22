// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { registerContextSlot } from '../../../root-context.js';

let delayedEvents: [handlerName: string, data: EventDataType][] | undefined;

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  delayedEvents ??= [];
  delayedEvents.push([handlerName, data]);
}

if (typeof __MULTI_PAGE__ !== 'undefined' && __MULTI_PAGE__) {
  registerContextSlot({
    id: 'delayedEvents',
    init: () => undefined,
    save(bag) {
      bag['delayedEvents'] = delayedEvents;
    },
    load(bag) {
      delayedEvents = bag['delayedEvents'] as typeof delayedEvents;
    },
  });
}

export { delayedEvents, delayedPublishEvent };
