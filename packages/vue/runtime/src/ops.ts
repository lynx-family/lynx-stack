// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Flat-array operation codes shared between Background and Main Thread.
 *
 * Format (all numbers/strings, JSON-serializable):
 *   CREATE:       [0, id, type]
 *   CREATE_TEXT:  [1, id]              – text node; use SET_TEXT to set content
 *   INSERT:       [2, parentId, childId, anchorId]  anchorId=-1 means append
 *   REMOVE:       [3, parentId, childId]
 *   SET_PROP:     [4, id, key, value]
 *   SET_TEXT:     [5, id, text]
 *   SET_EVENT:    [6, id, eventType, eventName, sign]
 *   REMOVE_EVENT: [7, id, eventType, eventName]
 *   SET_STYLE:    [8, id, styleValue]   styleValue is string | object
 *   SET_CLASS:    [9, id, classString]
 *   SET_ID:       [10, id, idString]
 *   SET_WORKLET_EVENT: [11, id, eventType, eventName, workletCtx]
 *   SET_MT_REF:   [12, id, refImpl]
 */
export const OP = {
  CREATE: 0,
  CREATE_TEXT: 1,
  INSERT: 2,
  REMOVE: 3,
  SET_PROP: 4,
  SET_TEXT: 5,
  SET_EVENT: 6,
  REMOVE_EVENT: 7,
  SET_STYLE: 8,
  SET_CLASS: 9,
  SET_ID: 10,
  SET_WORKLET_EVENT: 11,
  SET_MT_REF: 12,
} as const;

let buffer: unknown[] = [];

export function pushOp(...args: unknown[]): void {
  for (const arg of args) {
    buffer.push(arg);
  }
}

export function takeOps(): unknown[] {
  const b = buffer;
  buffer = [];
  return b;
}
