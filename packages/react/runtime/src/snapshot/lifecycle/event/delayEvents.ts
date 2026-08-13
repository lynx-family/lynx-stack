// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext } from '../../../root-context.js';

function getDelayedEvents(): [handlerName: string, data: EventDataType][] | undefined {
  return getCurrentRootContext().delayedEvents;
}

function delayedPublishEvent(handlerName: string, data: EventDataType): void {
  const ctx = getCurrentRootContext();
  ctx.delayedEvents ??= [];
  ctx.delayedEvents.push([handlerName, data]);
}

export { delayedPublishEvent, getDelayedEvents };
