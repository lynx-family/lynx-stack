// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { HostContextProxy, HostMessageEvent } from './host-types.js';
import { dispatchListeners } from './protocol.js';
import type { Unsubscribe } from './types.js';

/** @internal */
export interface MultiplexEntry<TCallback> {
  listeners: Map<TCallback, Unsubscribe>;
  unsubscribeHost: Unsubscribe;
}

/** @internal */
export type MultiplexMap<TCallback> = Map<string, MultiplexEntry<TCallback>>;

/** @internal */
export type MessageSubscriptions = MultiplexMap<(data: unknown) => void>;

/**
 * Share one underlying host listener per event key, deduplicating identical
 * callbacks and unsubscribing from the host when the last listener leaves.
 * @internal
 */
export function subscribeMultiplexed<
  TCallback extends (...args: never[]) => void,
>(
  subscriptions: MultiplexMap<TCallback>,
  key: string,
  callback: TCallback,
  attachHost: (
    dispatch: (invoke: (fn: TCallback) => void) => void,
  ) => Unsubscribe,
): Unsubscribe {
  let entry = subscriptions.get(key);
  if (!entry) {
    const listeners = new Map<TCallback, Unsubscribe>();
    const unsubscribeHost = attachHost((invoke) => {
      dispatchListeners(listeners, invoke);
    });
    entry = { listeners, unsubscribeHost };
    subscriptions.set(key, entry);
  }
  const current = entry;
  const existing = current.listeners.get(callback);
  if (existing) return existing;

  const dispose = (): void => {
    if (current.listeners.get(callback) !== dispose) return;
    current.listeners.delete(callback);
    if (current.listeners.size === 0 && subscriptions.get(key) === current) {
      subscriptions.delete(key);
      current.unsubscribeHost();
    }
  };
  current.listeners.set(callback, dispose);
  return dispose;
}

/** @internal */
export function clearMultiplexed<TCallback>(
  subscriptions: MultiplexMap<TCallback>,
): void {
  for (const entry of subscriptions.values()) {
    entry.listeners.clear();
    entry.unsubscribeHost();
  }
  subscriptions.clear();
}

/**
 * Keep one host listener per message type without taking over the proxy's global hook.
 * @internal
 */
export function subscribeMessage<T>(
  subscriptions: MessageSubscriptions,
  proxy: HostContextProxy,
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  return subscribeMultiplexed(
    subscriptions,
    type,
    listener as (data: unknown) => void,
    (dispatch) => {
      const onEvent = (event: HostMessageEvent): void => {
        dispatch((fn) => {
          fn(event.data);
        });
      };
      proxy.addEventListener(type, onEvent);
      return () => {
        proxy.removeEventListener(type, onEvent);
      };
    },
  );
}
