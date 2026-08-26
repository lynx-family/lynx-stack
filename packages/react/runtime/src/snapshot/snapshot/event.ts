// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { SnapshotInstance } from '../snapshot/snapshot.js';

// `event::Event::BindType` in the engine.
const BIND_TYPE: Record<string, number> = {
  bindEvent: 1,
  'capture-bind': 2,
  'capture-catch': 3,
  catchEvent: 4,
  'global-bindEvent': 5,
};

// `ClosureType::kCore`: the callback is a main-thread function.
const CLOSURE_TYPE_CORE = 2;

/**
 * Binds the element event to a main-thread callback that forwards it to the
 * background thread.
 *
 * The engine's own background-event path resolves `publishEvent` on the app
 * object, which is per card. Producing the event on the main thread and letting
 * the background subscribe instead is what lets each page of a shared runtime
 * receive its own events.
 *
 * The listener is registered once per element event and reads the handler at
 * dispatch time, so re-renders neither re-register nor leak listeners.
 */
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
  if (!snapshot.__elements) {
    return;
  }

  const element = snapshot.__elements[elementIndex]!;
  const bound = (snapshot.__boundEvents ??= new Set<string>());
  const key = `${elementIndex}:${eventType}:${eventName}`;
  if (bound.has(key)) {
    return;
  }
  bound.add(key);

  console.info('[PROBE] bind', eventName, BIND_TYPE[eventType] ?? 1);
  // Declare the static event so the platform treats the element as touchable.
  __AddEvent(element, eventType, eventName, '__mt_forward__');
  __AddEventListener(element, eventName, (e: unknown) => {
    console.info('[PROBE] mts fired', eventName);
    const handlerName = snapshot.__values![expIndex] as string | undefined;
    if (!handlerName) {
      return;
    }
    lynx.getJSContext().dispatchEvent({
      type: '__SendPageEvent',
      data: ['', handlerName, e],
    });
  }, {
    closure_type: CLOSURE_TYPE_CORE,
    bind_type: BIND_TYPE[eventType] ?? 1,
  });
}

export { updateEvent };
