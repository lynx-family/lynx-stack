// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type EtEventHandler = (...args: unknown[]) => unknown;

const eventHandlerByEventValue = new Map<string, EtEventHandler>();

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
}

export function getEventHandlerForEventValue(eventValue: string): EtEventHandler | undefined {
  return eventHandlerByEventValue.get(eventValue);
}
