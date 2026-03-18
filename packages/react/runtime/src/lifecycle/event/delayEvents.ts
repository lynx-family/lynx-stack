// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const delayedEvents: [handlerName: string, data: EventDataType][] = [];

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  delayedEvents.push([handlerName, data]);
}

export { delayedPublishEvent, delayedEvents };
