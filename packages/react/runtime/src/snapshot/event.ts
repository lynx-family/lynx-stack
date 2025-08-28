// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { loadWorkletRuntime } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';
import type { BaseEvent } from '@lynx-js/types';

import { Element } from '../mtc/api/element.js';
import { SnapshotInstance } from '../snapshot.js';

const mtcEvents: Map<string, ((e: BaseEvent) => void)> = /*#__PURE__*/ new Map();

function registerMTCEvent(
  id: string,
  callback: undefined | ((e: BaseEvent) => void),
): Record<string, unknown> | undefined {
  if (!globalThis.lynxWorkletImpl) {
    // @ts-ignore
    loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
  }
  // @ts-ignore
  globalThis.runMTCEvent = (ctx: Worklet, e: [any]) => {
    const event = {
      ...e[0],
      target: new Element(e[0].target.elementRefptr),
      currentTarget: new Element(e[0].currentTarget.elementRefptr),
    } as BaseEvent;
    mtcEvents.get(ctx._wkltId)!(event);
  };

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
  let event: string | Record<string, unknown> | undefined;
  if (!value) {
    event = undefined;
    registerMTCEvent(eventId, undefined);
  } else if (typeof value === 'string' || (typeof value === 'object' && 'type' in value && value.type === 'worklet')) {
    event = value as Record<string, unknown>;
  } else if (typeof value === 'function') {
    // TODO: should unregister old event
    event = registerMTCEvent(eventId, value as ((e: BaseEvent) => void));
  } else {
    event = eventId;
  }

  snapshot.__values![expIndex] = event;
  if (snapshot.__elements) {
    __AddEvent(snapshot.__elements[elementIndex]!, eventType, eventName, event);
  }
}

export { updateEvent };
