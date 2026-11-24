// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ServerToClientMessage } from './types.js';

/**
 * One generation of a message buffer.
 *
 * `replace()` and `clear()` start a new generation; `push()` appends to the
 * current one. Generations form a singly linked list, so a reader that has
 * fallen behind still sees every message exactly once and in order, and a
 * generation is released as soon as no reader points at it.
 *
 * @internal
 */
export interface MessageEpoch {
  /** How this generation started. */
  readonly kind: 'initial' | 'replace' | 'clear';
  /**
   * Number of leading messages that were handed to `replace()`. They form one
   * atomic snapshot; everything after them was appended with `push()`.
   */
  readonly baseLength: number;
  /** The snapshot followed by every message pushed since. Append-only. */
  readonly messages: ServerToClientMessage[];
  /** The generation that superseded this one, once there is one. */
  next: MessageEpoch | null;
}

/**
 * A run of messages a reader has not seen yet.
 *
 * @internal
 */
export interface MessageRun {
  /**
   * `replace` carries a complete snapshot that supersedes all earlier state.
   * `append` carries messages to apply on top of the current state.
   */
  readonly kind: 'replace' | 'append';
  readonly messages: readonly ServerToClientMessage[];
  /**
   * Identity of the generation the run belongs to. A reader that rejects a
   * `replace` run uses it to skip that snapshot's appended tail.
   */
  readonly epoch: object;
}

/**
 * Reads a store's messages exactly once and in order.
 *
 * @internal
 */
export interface MessageReader {
  /** Return the next unread run, or `undefined` once caught up. */
  read(): MessageRun | undefined;
}

const journalKey = Symbol('a2ui.messageStore.epoch');
/** Lets a wrapper that only delegates `getSnapshot` still expose its epoch. */
const snapshotEpochs = new WeakMap<
  readonly ServerToClientMessage[],
  MessageEpoch
>();

/**
 * A buffer of raw protocol messages produced by the developer's IO module.
 * The store knows nothing about the v1.0 protocol: it does not parse,
 * process, or interpret messages. It only:
 *
 *  1. Stores them in arrival order.
 *  2. Notifies subscribers after every mutation.
 *  3. Hands the current buffer back via `getSnapshot()`.
 *
 * Protocol-aware processing (surfaces, signals, resources, action dispatch)
 * is the responsibility of `<A2UI>`. `<A2UI>` applies every mutation in the
 * order it was made, including several mutations made in one batch.
 *
 * The three mutations differ in what they do to rendered state:
 *
 * | Call | Buffer | Rendered state |
 * | --- | --- | --- |
 * | `push(messages)` | appends | applies each message in order |
 * | `replace(messages)` | becomes `messages` | reconciles to exactly `messages` |
 * | `clear()` | becomes empty | unchanged |
 *
 * The buffer keeps every pushed message until the next `replace()` or
 * `clear()`. A long-running stream should end with `replace(finalMessages)`,
 * or call `clear()` once its messages have been rendered, to release them.
 */
export interface MessageStore {
  /** `useSyncExternalStore` subscribe contract. Called after every mutation. */
  readonly subscribe: (cb: () => void) => () => void;
  /**
   * The current buffer as a frozen array. The reference is stable between
   * mutations, as `useSyncExternalStore` requires. Building it copies the
   * buffer, so read it when you need the messages rather than on every push.
   */
  readonly getSnapshot: () => readonly ServerToClientMessage[];
  /**
   * Append one or more raw messages to the buffer. Notifies subscribers
   * once per call, so pass an array to deliver several messages as one batch.
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
   * If A2UI rejects the snapshot, it keeps the live UI, reports the errors
   * once, and ignores messages pushed after it until a corrected `replace`
   * or a `clear`. Errors reach `onMessage` and the console; this buffer
   * method does not synchronously validate messages.
   *
   * @example
   * store.push(streamedMessages);
   * store.replace(finalMessages);
   */
  replace(messages: readonly ServerToClientMessage[]): void;
  /**
   * Reset the message buffer without clearing live surfaces. Notifies subscribers.
   * Messages pushed after this call are applied to the surfaces that are
   * already rendered. Use `replace([])` to remove rendered surfaces.
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
  let epoch: MessageEpoch = {
    kind: 'initial',
    baseLength: 0,
    messages: options.initialMessages ? [...options.initialMessages] : [],
    next: null,
  };
  // Built on demand, so a stream of pushes costs one append each instead of
  // one copy of the whole buffer each.
  let snapshot: readonly ServerToClientMessage[] | undefined;
  const subscribers = new Set<() => void>();

  const changed = () => {
    snapshot = undefined;
    for (const cb of [...subscribers]) {
      // A listener removed by an earlier listener in this pass is not called.
      if (subscribers.has(cb)) cb();
    }
  };
  const supersede = (
    kind: MessageEpoch['kind'],
    messages: ServerToClientMessage[],
  ) => {
    const next: MessageEpoch = {
      kind,
      baseLength: messages.length,
      messages,
      next: null,
    };
    epoch.next = next;
    epoch = next;
    changed();
  };

  const store: MessageStore = {
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    getSnapshot() {
      if (!snapshot) {
        snapshot = Object.freeze(epoch.messages.slice());
        snapshotEpochs.set(snapshot, epoch);
      }
      return snapshot;
    },
    push(message) {
      const incoming = Array.isArray(message)
        ? (message as readonly ServerToClientMessage[])
        : [message as ServerToClientMessage];
      if (incoming.length === 0) return;
      for (const item of incoming) epoch.messages.push(item);
      changed();
    },
    replace(messages) {
      supersede('replace', [...messages]);
    },
    clear() {
      if (epoch.messages.length === 0) return;
      supersede('clear', []);
    },
  };
  // Enumerable so that a wrapper built with object spread keeps it.
  Object.defineProperty(store, journalKey, {
    value: () => epoch,
    enumerable: true,
  });
  return store;
}

function currentEpoch(store: MessageStore): MessageEpoch | undefined {
  const journal = (store as { [journalKey]?: () => MessageEpoch })[journalKey];
  return typeof journal === 'function'
    ? journal()
    : snapshotEpochs.get(store.getSnapshot());
}

/**
 * Create a reader positioned at the start of the store's current buffer.
 *
 * With `adopt`, everything already in the buffer is delivered as one
 * `replace` run. A renderer that already holds state from another store uses
 * this to converge on the new store instead of stacking it on top.
 *
 * @internal
 */
export function createMessageReader(
  store: MessageStore,
  options: { adopt?: boolean } = {},
): MessageReader {
  const start = currentEpoch(store);
  if (!start) return createSnapshotReader(store, options.adopt === true);

  let epoch = start;
  let index = 0;
  // An empty snapshot still has to be delivered, so the index alone cannot
  // tell whether a generation's snapshot was handed out.
  let baseDelivered = false;
  let adopt = options.adopt === true;

  return {
    read() {
      for (;;) {
        if (adopt) {
          adopt = false;
          baseDelivered = true;
          index = epoch.messages.length;
          return {
            kind: 'replace',
            messages: epoch.messages.slice(),
            epoch,
          };
        }
        if (!baseDelivered) {
          baseDelivered = true;
          if (epoch.kind === 'replace') {
            index = epoch.baseLength;
            return {
              kind: 'replace',
              messages: epoch.messages.slice(0, epoch.baseLength),
              epoch,
            };
          }
        }
        if (index < epoch.messages.length) {
          const messages = epoch.messages.slice(index);
          index = epoch.messages.length;
          return { kind: 'append', messages, epoch };
        }
        if (!epoch.next) return undefined;
        epoch = epoch.next;
        index = 0;
        baseDelivered = false;
      }
    },
  };
}

/**
 * Reader for a store this module did not create. Such a store can only
 * express appends, so the reader follows the snapshot by length.
 */
function createSnapshotReader(
  store: MessageStore,
  adopt: boolean,
): MessageReader {
  const epoch = {};
  let index = 0;
  let pendingAdopt = adopt;
  return {
    read() {
      const snapshot = store.getSnapshot();
      if (pendingAdopt) {
        pendingAdopt = false;
        index = snapshot.length;
        return { kind: 'replace', messages: snapshot, epoch };
      }
      if (snapshot.length <= index) {
        index = snapshot.length;
        return undefined;
      }
      const messages = snapshot.slice(index);
      index = snapshot.length;
      return { kind: 'append', messages, epoch };
    },
  };
}
