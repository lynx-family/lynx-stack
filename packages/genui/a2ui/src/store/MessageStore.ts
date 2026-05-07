// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ServerToClientMessage } from './types.js';

/**
 * A pure append-only buffer of raw protocol messages produced by the
 * developer's IO module. The store knows nothing about the v0.9 protocol —
 * it does not parse, process, or interpret messages. It only:
 *
 *  1. Stores them in arrival order.
 *  2. Notifies subscribers when new ones land.
 *  3. Hands the current snapshot back via `getSnapshot()` (referentially
 *     stable between mutations — required by `useSyncExternalStore`).
 *
 * Protocol-aware processing — surfaces, signals, resources, action
 * dispatch — is the responsibility of `<A2UI>` (the renderer component).
 * Developers who don't want to learn the protocol should use `<A2UI>`;
 * developers who do can run their own `MessageProcessor` against the
 * snapshot directly.
 */
export interface MessageStore {
  /** `useSyncExternalStore` subscribe contract. */
  readonly subscribe: (cb: () => void) => () => void;
  /** `useSyncExternalStore` getSnapshot contract — stable between pushes. */
  readonly getSnapshot: () => readonly ServerToClientMessage[];
  /**
   * Append one or more raw messages to the buffer. Notifies subscribers
   * once per call (batches a single array argument into a single notify).
   */
  push(
    message: ServerToClientMessage | readonly ServerToClientMessage[],
  ): void;
  /** Reset the buffer. Notifies subscribers. */
  clear(): void;
}

export interface MessageStoreOptions {
  /**
   * Optional initial buffer contents. Useful when rehydrating a previous
   * agent response or replaying a fixture stream.
   */
  initialMessages?: readonly ServerToClientMessage[];
}

export function createMessageStore(
  options: MessageStoreOptions = {},
): MessageStore {
  let snapshot: readonly ServerToClientMessage[] = options.initialMessages
    ? Object.freeze([...options.initialMessages])
    : Object.freeze<ServerToClientMessage[]>([]);
  const subscribers = new Set<() => void>();

  const notify = () => {
    for (const cb of subscribers) cb();
  };

  return {
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    push(message) {
      const incoming = Array.isArray(message)
        ? (message as ServerToClientMessage[])
        : [message as ServerToClientMessage];
      if (incoming.length === 0) return;
      snapshot = Object.freeze([...snapshot, ...incoming]);
      notify();
    },
    clear() {
      if (snapshot.length === 0) return;
      snapshot = Object.freeze<ServerToClientMessage[]>([]);
      notify();
    },
  };
}
