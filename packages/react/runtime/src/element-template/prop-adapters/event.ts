// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { backgroundElementTemplateInstanceManager } from '../background/manager.js';

export type EtEventHandler = (...args: unknown[]) => unknown;

const pendingEvents: Array<[eventValue: string, data: unknown]> = [];
let queuePendingEvents = false;

function dispatchEvent(eventValue: string, data: unknown): boolean {
  const handler = backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(eventValue);
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
  pendingEvents.length = 0;
  queuePendingEvents = false;
}

export function resetEventStateForRuntime(): void {
  clearEventState();
  queuePendingEvents = true;
}

export function getEventHandlerForEventValue(eventValue: string): EtEventHandler | undefined {
  const handler = backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(eventValue);
  return typeof handler === 'function' ? (handler as EtEventHandler) : undefined;
}

export function publishEvent(eventValue: string, data: unknown): void {
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
  data: unknown,
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
