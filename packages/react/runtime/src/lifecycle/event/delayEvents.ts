// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
let delayedEvents: [handlerName: string, data: EventDataType][] | undefined;

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  delayedEvents ??= [];
  delayedEvents.push([handlerName, data]);
}

export { delayedPublishEvent, delayedEvents };
