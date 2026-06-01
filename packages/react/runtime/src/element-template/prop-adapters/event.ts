// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { backgroundElementTemplateInstanceManager } from '../background/manager.js';

export type EtEventHandler = (data: EventDataType) => unknown;

const pendingEvents: Array<[eventValue: string, data: EventDataType]> = [];
let queuePendingEvents = false;

function dispatchEvent(eventValue: string, data: EventDataType): boolean {
  const handler = backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(eventValue);
  if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
    console.alog?.(
      `[ReactLynxDebug] ElementTemplate BTS received event:\n${
        JSON.stringify(
          {
            eventValue,
            type: data.type,
            jsFunctionName: typeof handler === 'function' ? handler.name : '',
            hasHandler: typeof handler === 'function',
          },
          null,
          2,
        )
      }`,
    );
  }
  if (typeof handler !== 'function') {
    return false;
  }

  try {
    (handler as EtEventHandler)(data);
  } catch (error) {
    lynx.reportError(error as Error);
  }
  return true;
}

export function clearEventState(): void {
  clearPendingEvents();
  queuePendingEvents = false;
}

export function clearPendingEvents(): void {
  pendingEvents.length = 0;
}

export function resetEventStateForRuntime(): void {
  clearEventState();
  queuePendingEvents = true;
}

export function getEventHandlerForEventValue(eventValue: string): EtEventHandler | undefined {
  const handler = backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(eventValue);
  return typeof handler === 'function' ? (handler as EtEventHandler) : undefined;
}

export function publishEvent(eventValue: string, data: EventDataType): void {
  if (dispatchEvent(eventValue, data)) {
    return;
  }
  if (queuePendingEvents) {
    pendingEvents.push([eventValue, data]);
  }
}

export function publicComponentEvent(
  _componentId: string,
  eventValue: string,
  data: EventDataType,
): void {
  publishEvent(eventValue, data);
}

export function flushPendingEvents(): void {
  queuePendingEvents = false;
  if (pendingEvents.length === 0) {
    return;
  }
  const events = pendingEvents.splice(0);
  for (const [eventValue, data] of events) {
    dispatchEvent(eventValue, data);
  }
}
