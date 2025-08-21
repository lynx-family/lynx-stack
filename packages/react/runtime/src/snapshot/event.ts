// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BaseEvent } from '@lynx-js/types';

import { Element } from '../../../worklet-runtime/src/api/element.js';
import { SnapshotInstance } from '../snapshot.js';

const mtcEvents: Map<number, (e: unknown) => void> = /*#__PURE__*/ new Map();

function registerMTCEvent(id: string, callback: undefined | ((e: BaseEvent) => void)): unknown {
  if (!callback) {
    mtcEvents.delete(id);
    return undefined;
  }
  mtcEvents.set(id, callback);
  return {
    type: 'worklet',
    value: {
      _workletType: 'mtc',
      _wkltId: id,
    },
  };
}

globalThis.runWorklet = (w, e: [BaseEvent]) => {
  const event = {
    ...e[0],
    target: new Element(e[0].target.elementRefptr),
    currentTarget: new Element(e[0].currentTarget.elementRefptr),
  };
  console.log('yra runWorklet', w, event);
  mtcEvents.get(w._wkltId)(event);
};

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
  const eventId = `${snapshot.__id}:${expIndex}:${spreadKey}`;
  let event;
  if (!value) {
    event = undefined;
    registerMTCEvent(eventId, undefined);
  } else if (typeof value === 'string' || (typeof value === 'object' && value.type === 'worklet')) {
    event = value;
  } else if (typeof value === 'function') {
    // TODO: should unregister old event
    event = registerMTCEvent(eventId, value);
  } else {
    event = eventId;
  }

  snapshot.__values![expIndex] = event;
  if (snapshot.__elements) {
    __AddEvent(snapshot.__elements[elementIndex]!, eventType, eventName, event);
  }
}

export { updateEvent };
