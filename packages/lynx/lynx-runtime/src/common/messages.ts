// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  HostContextProxy,
  HostMessageEvent,
  Unsubscribe,
} from './types.js';

interface MessageSubscription {
  proxy: HostContextProxy;
  listeners: Set<MessageRegistration>;
  dispatch: (event: HostMessageEvent) => void;
}

interface MessageRegistration {
  callback: ((data: unknown) => void) | undefined;
  dispose: Unsubscribe;
}

export type MessageSubscriptions = Map<string, MessageSubscription>;

/** Keep one host listener per type without taking over the proxy's global hook. */
export function subscribeMessage<T>(
  subscriptions: MessageSubscriptions,
  proxy: HostContextProxy,
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  let entry = subscriptions.get(type);
  if (!entry) {
    const listeners = new Set<MessageRegistration>();
    const dispatch = (event: HostMessageEvent): void => {
      let failed = false;
      let firstError: unknown;
      // Match host EventTarget mutation semantics: additions wait until the next
      // dispatch, and removals (including destruction) take effect immediately.
      for (const registration of [...listeners]) {
        if (!listeners.has(registration)) continue;
        const callback = registration.callback!;
        try {
          callback(event.data);
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
    };
    entry = { proxy, listeners, dispatch };
    proxy.addEventListener(type, dispatch);
    subscriptions.set(type, entry);
  }
  const current = entry;
  const callback = listener as (data: unknown) => void;
  for (const registration of current.listeners) {
    if (registration.callback === callback) return registration.dispose;
  }
  const registration: MessageRegistration = {
    callback,
    dispose: () => {
      if (!current.listeners.delete(registration)) return;
      registration.callback = undefined;
      if (current.listeners.size > 0 || subscriptions.get(type) !== current) {
        return;
      }
      current.proxy.removeEventListener(type, current.dispatch);
      subscriptions.delete(type);
    },
  };
  current.listeners.add(registration);
  return registration.dispose;
}

export function clearMessages(subscriptions: MessageSubscriptions): void {
  for (const [type, entry] of subscriptions) {
    for (const registration of entry.listeners) {
      registration.callback = undefined;
    }
    entry.listeners.clear();
    entry.proxy.removeEventListener(type, entry.dispatch);
  }
  subscriptions.clear();
}
