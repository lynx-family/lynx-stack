// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Reference mock IO module. Pushes a fixed initial stream into the store
// and serves canned responses to user actions. NOT shipped from
// `@lynx-js/genui/a2ui` — copy as a starting point for tests / demos.
import type {
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/genui/a2ui';

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
  /** Progress callback for playback sync. */
  onProgress?: (state: MockAgentProgress) => void;
}

export interface MockAgentProgress {
  deliveredCount: number;
  totalCount: number;
  status: 'idle' | 'streaming' | 'paused' | 'done';
}

export interface MockAgent {
  /**
   * Begin streaming the initial messages. Idempotent — calling twice
   * returns the original promise.
   */
  start(): Promise<void>;
  /** Pause streaming until `resume()` is called. */
  pause(): void;
  /** Resume a paused stream. */
  resume(): void;
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
  const {
    initialMessages,
    actionMocks = {},
    delayMs = 800,
    onProgress,
  } = options;
  const abort = new AbortController();
  let started: Promise<void> | null = null;
  let paused = false;
  const stateListeners = new Set<() => void>();
  let currentTotalCount = initialMessages?.length ?? 0;

  function notifyStateChange() {
    for (const listener of [...stateListeners]) {
      listener();
    }
  }

  function emitProgress(status: MockAgentProgress['status']) {
    try {
      onProgress?.({
        deliveredCount: store.getSnapshot().length,
        totalCount: currentTotalCount,
        status,
      });
    } catch {
      // Progress is advisory; stream delivery must continue even if
      // observers fail.
    }
  }

  function pause() {
    if (paused) return;
    paused = true;
    emitProgress('paused');
    notifyStateChange();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    emitProgress('streaming');
    notifyStateChange();
  }

  function waitForStateChange(): Promise<void> {
    if (abort.signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        stateListeners.delete(onStateChange);
        abort.signal.removeEventListener('abort', onAbort);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        finish();
      };
      const onStateChange = () => {
        finish();
      };
      stateListeners.add(onStateChange);
      abort.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function waitWhilePaused(): Promise<void> {
    while (paused && !abort.signal.aborted) {
      await waitForStateChange();
    }
  }

  function sleep(ms: number): Promise<void> {
    if (ms <= 0 || abort.signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let finished = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        stateListeners.delete(onStateChange);
        abort.signal.removeEventListener('abort', onAbort);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        finish();
      };
      const onStateChange = () => {
        if (paused || abort.signal.aborted) {
          finish();
        }
      };
      timer = setTimeout(finish, ms);
      stateListeners.add(onStateChange);
      abort.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function streamInto(
    messages: readonly ServerToClientMessage[],
  ): Promise<void> {
    currentTotalCount = messages.length;
    if (messages.length === 0) {
      emitProgress(paused ? 'paused' : 'done');
      return;
    }
    emitProgress(paused ? 'paused' : 'streaming');
    for (const msg of messages) {
      await waitWhilePaused();
      if (abort.signal.aborted) return;
      store.push(msg);
      emitProgress(paused ? 'paused' : 'streaming');
      if (delayMs > 0) {
        await sleep(delayMs);
        if (abort.signal.aborted) return;
      }
    }
    emitProgress(paused ? 'paused' : 'done');
  }

  return {
    start() {
      if (started) return started;
      started = streamInto(initialMessages ?? []);
      return started;
    },
    pause,
    resume,
    async onAction(action) {
      await waitWhilePaused();
      const mock = actionMocks[action.name];
      if (!mock) return;
      const stream = typeof mock === 'function' ? mock(action) : mock;
      await streamInto(stream);
    },
    stop() {
      abort.abort();
      emitProgress('idle');
    },
  };
}
