// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  EventDispatcher,
  EventSubscriber,
  RuntimeEvent,
  RuntimeEventTarget,
} from './types.js';

interface ListenerRegistration {
  listener: (event: RuntimeEvent) => void;
  name: string;
}

export interface EventChannel<
  IncomingEvents extends object,
  OutgoingEvents extends object,
> {
  destroy(): void;
  dispatch: EventDispatcher<OutgoingEvents>;
  on: EventSubscriber<IncomingEvents>;
}

export function createEventChannel<
  IncomingEvents extends object,
  OutgoingEvents extends object,
>(
  target: RuntimeEventTarget,
): EventChannel<IncomingEvents, OutgoingEvents> {
  const listeners = new Set<ListenerRegistration>();
  let destroyed = false;

  const assertActive = (): void => {
    if (destroyed) {
      throw new Error('Cannot use a destroyed Lynx runtime event channel.');
    }
  };

  const dispatch: EventDispatcher<OutgoingEvents> = (name, data) => {
    assertActive();
    target.dispatchEvent({ type: name, data });
  };

  const on: EventSubscriber<IncomingEvents> = (name, handler) => {
    assertActive();

    const listener = (event: RuntimeEvent): void => {
      handler(event.data as IncomingEvents[typeof name]);
    };
    const registration: ListenerRegistration = { name, listener };
    let subscribed = true;

    listeners.add(registration);
    target.addEventListener(name, listener);

    return (): void => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      listeners.delete(registration);
      target.removeEventListener(name, listener);
    };
  };

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;

    for (const { name, listener } of listeners) {
      target.removeEventListener(name, listener);
    }
    listeners.clear();
  };

  return { destroy, dispatch, on };
}
