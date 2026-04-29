// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Reference mock IO module. Pushes a fixed initial stream into the store
// and serves canned responses to user actions. NOT shipped from
// `@lynx-js/a2ui-reactlynx` — copy as a starting point for tests / demos.
import type {
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/a2ui-reactlynx';

export interface MockAgentOptions {
  /** Streamed once after `start()`. */
  initialMessages?: readonly ServerToClientMessage[];
  /** Per-action response messages, keyed by action name. */
  actionMocks?: Record<
    string,
    | readonly ServerToClientMessage[]
    | ((ctx: UserActionPayload) => readonly ServerToClientMessage[])
  >;
  /** Delay between successive batches when streaming. */
  delayMs?: number;
}

export interface MockAgent {
  /**
   * Begin streaming the initial messages. Idempotent — calling twice
   * returns the original promise.
   */
  start(): Promise<void>;
  /** Forward a user action; pushes the canned response, if any. */
  onAction(action: UserActionPayload): Promise<void>;
  /** Stop streaming and discard any pending messages. */
  stop(): void;
}

/**
 * Build a mock agent driver bound to a `MessageStore`. The driver
 * streams raw protocol messages into the store with a small delay
 * between each, simulating an SSE-like server.
 */
export function createMockAgent(
  store: MessageStore,
  options: MockAgentOptions = {},
): MockAgent {
  const { initialMessages, actionMocks = {}, delayMs = 800 } = options;
  const abort = new AbortController();
  let started: Promise<void> | null = null;

  async function streamInto(
    messages: readonly ServerToClientMessage[],
  ): Promise<void> {
    for (const msg of messages) {
      if (abort.signal.aborted) return;
      store.push(msg);
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return {
    start() {
      if (started) return started;
      started = streamInto(initialMessages ?? []);
      return started;
    },
    async onAction(action) {
      const mock = actionMocks[action.name];
      if (!mock) return;
      const stream = typeof mock === 'function' ? mock(action) : mock;
      await streamInto(stream);
    },
    stop() {
      abort.abort();
    },
  };
}
