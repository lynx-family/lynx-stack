// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Reference SSE IO module. Opens an EventSource, parses `delta` /
// `complete` events, normalizes their payloads, and pushes the resulting
// raw protocol messages into the store. NOT shipped from
// `@lynx-js/a2ui-reactlynx` — copy and adapt the URL building, event
// names, and queueing for your agent.
import type {
  A2UIClientEventMessage,
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/a2ui-reactlynx';
import { normalizePayloadToMessages } from '@lynx-js/a2ui-reactlynx';

const MESSAGE_PROCESS_DELAY = 300;

interface TypedEventSource {
  addEventListener(
    type: string,
    listener: (
      event: { data?: unknown; target?: unknown; type?: string },
    ) => void,
  ): void;
  close(): void;
  readyState: number;
}

declare const lynx: {
  EventSource?: new(url: string) => TypedEventSource;
} | undefined;

function buildSseParams(
  message: A2UIClientEventMessage,
  messageId: string,
): Record<string, string> {
  const params: Record<string, string> = { messageId };
  const anyMessage = message as Record<string, unknown>;

  if (typeof message === 'string') {
    params.text = message;
  } else if (anyMessage) {
    if (typeof anyMessage.text === 'string') {
      params.text = anyMessage.text;
    } else if (anyMessage.text) {
      params.text = JSON.stringify(anyMessage.text);
    } else if (anyMessage.userAction) {
      const userAction = anyMessage.userAction as {
        name: string;
        context?: Record<string, unknown>;
      };
      const actionName = userAction.name || 'unknownAction';
      const context = userAction.context ?? {};
      params.text = `USER_ACTION: ${actionName}, Context: ${
        JSON.stringify(context)
      }`;
    } else {
      params.text = JSON.stringify(message);
    }

    if (typeof anyMessage.sessionId === 'string') {
      params.sessionId = anyMessage.sessionId;
    } else if (anyMessage.sessionId) {
      params.sessionId = JSON.stringify(anyMessage.sessionId);
    }
  }

  return params;
}

function randomId(prefix: string) {
  return prefix + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10);
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export interface SseAgentOptions {
  url: string;
}

export interface SseAgent {
  /**
   * Send an input to the agent and stream the response messages into the
   * store. Returns when the SSE connection emits its `complete` event.
   */
  send(input: A2UIClientEventMessage | string): Promise<void>;
  /**
   * Forward a user action — convenience over `send({ userAction })`.
   */
  onAction(action: UserActionPayload): Promise<void>;
  /** Abort any open connections. */
  stop(): void;
}

export function createSseAgent(
  store: MessageStore,
  options: SseAgentOptions,
): SseAgent {
  const { url: baseUrl } = options;
  const abort = new AbortController();

  const send = (input: A2UIClientEventMessage | string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (abort.signal.aborted) {
        resolve();
        return;
      }
      const messageId = randomId('task_');
      const params = new URLSearchParams(buildSseParams(input, messageId));
      const url = `${baseUrl}?${params.toString()}`;

      const g = globalThis as Record<string, unknown>;
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      const NativeES = g.EventSource as
        | (new(url: string) => TypedEventSource)
        | undefined;
      const EventSourceImpl = NativeES
        ?? (typeof lynx !== 'undefined' && lynx?.EventSource);
      if (!EventSourceImpl) {
        reject(new Error('No EventSource implementation available.'));
        return;
      }

      const eventSource = new EventSourceImpl(url);
      let settled = false;
      const queue: ServerToClientMessage[][] = [];

      const cleanup = () => {
        eventSource.close();
        abort.signal.removeEventListener('abort', onAbort);
        queue.length = 0;
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = (e: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(toError(e));
      };
      const onAbort = () => succeed();
      abort.signal.addEventListener('abort', onAbort, { once: true });

      let isCompleted = false;
      let hasReceivedDelta = false;
      let isProcessing = false;

      const flush = async () => {
        if (isProcessing) return;
        isProcessing = true;
        while (queue.length > 0 && !settled) {
          const batch = queue.shift();
          if (batch && batch.length > 0) {
            for (const msg of batch) {
              msg.messageId ??= messageId;
              store.push(msg);
            }
          }
          await new Promise((r) => setTimeout(r, MESSAGE_PROCESS_DELAY));
        }
        isProcessing = false;
      };

      const ingestPayload = (raw: unknown) => {
        let payload = raw;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            /* leave as string */
          }
        }
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            /* leave as string */
          }
        }
        const messages = normalizePayloadToMessages(payload);
        if (messages.length > 0) {
          queue.push(messages);
          void flush();
        }
      };

      eventSource.addEventListener('delta', (event) => {
        try {
          ingestPayload(event.data);
          hasReceivedDelta = true;
        } catch (e) {
          fail(e);
        }
      });

      eventSource.addEventListener('complete', (event) => {
        if (isCompleted) return;
        isCompleted = true;
        try {
          if (!hasReceivedDelta) ingestPayload(event.data);
        } catch (e) {
          fail(e);
          return;
        }
        succeed();
      });

      eventSource.addEventListener('error', (event) => {
        fail(new Error(`SSE error: ${JSON.stringify(event)}`));
      });
    });

  return {
    send,
    async onAction(action) {
      await send({ userAction: action });
    },
    stop() {
      abort.abort();
    },
  };
}
