// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type EtEventHandler = (...args: unknown[]) => unknown;

const eventHandlerByEventValue = new Map<string, EtEventHandler>();
const pendingEvents: Array<[eventValue: string, data: unknown]> = [];
let queuePendingEvents = false;

function dispatchEvent(eventValue: string, data: unknown): boolean {
  const handler = eventHandlerByEventValue.get(eventValue);
  if (!handler) {
    return false;
  }

  try {
    handler(data);
  } catch (error) {
    lynx.reportError(error as Error);
  }
  return true;
}

export function setEventHandler(
  handleId: number,
  attrSlotIndex: number,
  handler: EtEventHandler,
): void {
  eventHandlerByEventValue.set(`${handleId}:${attrSlotIndex}:`, handler);
}

export function deleteEventHandler(handleId: number, attrSlotIndex: number): void {
  eventHandlerByEventValue.delete(`${handleId}:${attrSlotIndex}:`);
}

export function clearEventHandlers(): void {
  eventHandlerByEventValue.clear();
  pendingEvents.length = 0;
  queuePendingEvents = false;
}

export function resetEventHandlersForRuntime(): void {
  clearEventHandlers();
  queuePendingEvents = true;
}

export function getEventHandlerForEventValue(eventValue: string): EtEventHandler | undefined {
  return eventHandlerByEventValue.get(eventValue);
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
