// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { SnapshotInstance } from '../snapshot/snapshot.js';

function updateEvent(
  snapshot: SnapshotInstance,
  expIndex: number,
  _oldValue: any,
  elementIndex: number,
  eventType: string,
  eventName: string,
  spreadKey: string,
): void {
  const value = snapshot.__values![expIndex];
  let event;
  if (!value) {
    event = undefined;
  } else if (typeof value === 'string') {
    event = value;
  } else {
    event = `${snapshot.__id}:${expIndex}:${spreadKey}`;
  }

  // todo: reuseId?

  snapshot.__values![expIndex] = event;
  if (snapshot.__elements) {
    __AddEvent(snapshot.__elements[elementIndex]!, eventType, eventName, event);
  }
}

export { updateEvent };
