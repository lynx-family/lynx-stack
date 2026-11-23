// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ServerToClientMessage } from './types.js';

const replacements = new WeakMap<
  readonly ServerToClientMessage[],
  readonly ServerToClientMessage[]
>();
const resets = new WeakMap<
  readonly ServerToClientMessage[],
  readonly ServerToClientMessage[]
>();

/** Read the replacement boundary associated with a raw-message snapshot. @internal */
export function getSnapshotReplacement(
  snapshot: readonly ServerToClientMessage[],
): readonly ServerToClientMessage[] | undefined {
  return replacements.get(snapshot);
}

/** Read the buffer-clear boundary associated with a snapshot. @internal */
export function getSnapshotReset(
  snapshot: readonly ServerToClientMessage[],
): readonly ServerToClientMessage[] | undefined {
  return resets.get(snapshot);
}

/**
 * A pure buffer of raw protocol messages produced by the
 * developer's IO module. The store knows nothing about the v1.0 protocol —
 * it does not parse, process, or interpret messages. It only:
 *
 *  1. Stores them in arrival order.
 *  2. Notifies subscribers when messages are appended or replaced.
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
  /** `useSyncExternalStore` getSnapshot contract — stable between mutations. */
  readonly getSnapshot: () => readonly ServerToClientMessage[];
  /**
   * Append one or more raw messages to the buffer. Notifies subscribers
   * once per call (batches a single array argument into a single notify).
   */
  push(
    message: ServerToClientMessage | readonly ServerToClientMessage[],
  ): void;
  /**
   * Replace the entire buffer with a complete message history or state snapshot.
   * Notifies subscribers once. A2UI reconciles the resulting state, reusing
   * unchanged components and preserving local input where server data is unchanged.
   * Missing surfaces, components, and server data fields are removed.
   * RPC calls and responses in the replacement are not replayed; use `push` for them.
   * If A2UI rejects the snapshot, it keeps the live UI and blocks the appended
   * tail until a corrected `replace` or `clear`. Errors reach `onMessage` and
   * the console; this buffer method does not synchronously validate messages.
   *
   * @example
   * store.push(streamedMessages);
   * store.replace(finalMessages);
   */
  replace(messages: readonly ServerToClientMessage[]): void;
  /**
   * Reset the message buffer without clearing live surfaces. Notifies subscribers.
   * Messages pushed after this call are consumed from the new buffer, including
   * when both calls occur in the same batch.
   */
  clear(): void;
}

/**
 * Options used when creating a raw A2UI message buffer.
 */
export interface MessageStoreOptions {
  /**
   * Optional initial buffer contents. Useful when rehydrating a previous
   * agent response or replaying a fixture stream.
   */
  initialMessages?: readonly ServerToClientMessage[];
}

/**
 * Create a raw-message buffer supporting append and replacement for `useSyncExternalStore`.
 */
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
  const replace = (messages: readonly ServerToClientMessage[]) => {
    snapshot = Object.freeze([...messages]);
    replacements.set(snapshot, snapshot);
    notify();
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
      const replacement = replacements.get(snapshot);
      const reset = resets.get(snapshot);
      snapshot = Object.freeze([...snapshot, ...incoming]);
      if (replacement) replacements.set(snapshot, replacement);
      if (reset) resets.set(snapshot, reset);
      notify();
    },
    replace,
    clear() {
      if (snapshot.length === 0) return;
      snapshot = Object.freeze<ServerToClientMessage[]>([]);
      resets.set(snapshot, snapshot);
      notify();
    },
  };
}
