// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AgentA2UIEvent,
  AgentDeltaEvent,
  AgentDoneEvent,
  AgentErrorEvent,
  AgentHealthResponse,
  AgentInterruptResponse,
  AgentSessionResponse,
  AgentStatusEvent,
} from './agentTypes.js';

export interface StreamChatOptions {
  sessionId: string;
  text: string;
  onStatus?: (payload: AgentStatusEvent) => void;
  onDelta?: (payload: AgentDeltaEvent) => void;
  onA2UI?: (payload: AgentA2UIEvent) => void;
  onDone?: (payload: AgentDoneEvent) => void;
  onError?: (payload: AgentErrorEvent) => void;
}

function parseSseChunk(
  chunk: string,
  onEvent: (eventName: string, data: unknown) => void,
): string {
  let buffer = chunk;
  let separatorIndex = buffer.indexOf('\n\n');

  while (separatorIndex !== -1) {
    const rawEvent = buffer.slice(0, separatorIndex);
    buffer = buffer.slice(separatorIndex + 2);

    const lines = rawEvent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean);
    const eventName = lines.find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim();
    const dataText = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    if (eventName) {
      let parsed: unknown = dataText;
      if (dataText) {
        try {
          parsed = JSON.parse(dataText);
        } catch {
          parsed = dataText;
        }
      }
      onEvent(eventName, parsed);
    }

    separatorIndex = buffer.indexOf('\n\n');
  }

  return buffer;
}

export async function getHealth(): Promise<AgentHealthResponse> {
  const response = await window.fetch('/__agent/health', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Health request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<AgentHealthResponse>;
}

export async function createSession(): Promise<AgentSessionResponse> {
  const response = await window.fetch('/__agent/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  if (!response.ok) {
    throw new Error(`Session request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<AgentSessionResponse>;
}

export async function interrupt(
  sessionId: string,
): Promise<AgentInterruptResponse> {
  const response = await window.fetch('/__agent/interrupt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Interrupt request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<AgentInterruptResponse>;
}

export function streamChat(options: StreamChatOptions): AbortController {
  const controller = new AbortController();

  void (async () => {
    try {
      const url = new URL('/__agent/chat', window.location.origin);
      url.searchParams.set('sessionId', options.sessionId);
      url.searchParams.set('text', options.text);

      const response = await window.fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed with ${String(response.status)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, (eventName, data) => {
          if (eventName === 'status') {
            options.onStatus?.(data as AgentStatusEvent);
            return;
          }

          if (eventName === 'delta') {
            options.onDelta?.(data as AgentDeltaEvent);
            return;
          }

          if (eventName === 'a2ui') {
            options.onA2UI?.(data as AgentA2UIEvent);
            return;
          }

          if (eventName === 'done') {
            options.onDone?.(data as AgentDoneEvent);
            return;
          }

          if (eventName === 'error') {
            options.onError?.(data as AgentErrorEvent);
          }
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      options.onError?.({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return controller;
}
