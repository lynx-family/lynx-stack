// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import type { A2UIAction } from './a2ui.js';
import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  getChatEndpoint,
  parseTokenUsage,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import type {
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatRequestContext,
  ChatStreamAdapter,
  ChatStreamEmission,
} from './type.js';

interface ExpressOutput {
  source: string;
  messages: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function expressRequest(
  { conversation, settings, host }: Omit<
    ChatRequestContext<ProviderSettings>,
    'signal' | 'prompt'
  >,
  prompt: string,
) {
  return {
    url: getChatEndpoint('a2ui-express', host, settings),
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: {
      messages: [{ role: 'user', content: prompt }],
      conversation,
      ...toProviderRequestOptions(settings),
    },
  };
}

function finalStep(payload: unknown) {
  if (
    !isRecord(payload) || typeof payload.text !== 'string'
    || !isRecord(payload.metadata) || !Array.isArray(payload.metadata.messages)
    || payload.metadata.messages.length === 0
  ) {
    throw new Error('The server returned no compiled A2UI Express surface.');
  }
  const emissions: ChatStreamEmission<ExpressOutput>[] = [];
  const usage = parseTokenUsage(payload.usage);
  if (usage) emissions.push({ type: 'usage', usage });
  const preview = payload.metadata.preview;
  if (isRecord(preview) && typeof preview.messagesUrl === 'string') {
    emissions.push({
      type: 'previewPayload',
      value: { messagesUrl: preview.messagesUrl },
    });
  }
  emissions.push({
    type: 'final',
    output: { source: payload.text, messages: payload.metadata.messages },
  });
  return { state: payload.text, emissions };
}

const stream: ChatStreamAdapter<string, ExpressOutput> = {
  initial: () => '',
  reduce(state, frame) {
    if (frame.event === 'done') return finalStep(frame.data);
    if (frame.event === 'error') throw new Error(stream.error(frame.data));
    if (
      frame.event === 'message' && isRecord(frame.data)
      && Array.isArray(frame.data.messages)
    ) {
      return {
        state,
        emissions: [{
          type: 'partial',
          output: { source: state, messages: frame.data.messages },
        }],
      };
    }
    if (
      frame.event === 'delta' && isRecord(frame.data)
      && typeof frame.data.text === 'string'
    ) {
      const source = state + frame.data.text;
      return { state: source, emissions: [{ type: 'progress', text: source }] };
    }
    return { state, emissions: [] };
  },
  fromJson: finalStep,
  finish: () => null,
  error(value) {
    const error = isRecord(value) ? value.error ?? value.message : value;
    return isRecord(error) && typeof error.message === 'string'
      ? error.message
      : (typeof error === 'string'
        ? error
        : 'A2UI Express generation failed.');
  },
};

const welcome: ChatMessageModel = {
  kind: 'assistant',
  text: 'Describe the UI you want to generate with A2UI Express.',
};
const transcript = {
  ...A2UI_CHAT_ADAPTER.transcript,
  pending: (): ChatMessageModel => ({
    kind: 'assistant',
    tone: 'pending',
    text: 'Generating A2UI Express…',
  }),
  progress: (text: string): ChatMessageModel => ({
    kind: 'output',
    tone: 'pending',
    text: 'A2UI Express',
    payload: text,
  }),
  success: (
    output: ExpressOutput,
  ): ChatMessageModel[] => [{
    kind: 'output',
    text: 'A2UI Express',
    payload: output.source,
  }],
};

export const EXPRESS_CHAT_ADAPTER = {
  id: 'a2ui-express',
  copy: {
    ...A2UI_CHAT_ADAPTER.copy,
    agentLabel: 'A2UI Express',
    progressLabel: 'Generating A2UI Express…',
  },
  suggestions: A2UI_CHAT_ADAPTER.suggestions,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest: context => expressRequest(context, context.prompt),
  stream,
  hydrate({ history, previewMessages }) {
    const messages: ChatMessageModel[] = [welcome];
    let output: ExpressOutput | null = null;
    let metrics;
    for (const turn of history) {
      metrics = turn.previewMetrics ?? metrics;
      if (turn.role === 'user') {
        messages.push({ kind: 'user', text: turn.content });
      }
      if (turn.role !== 'assistant') continue;
      if (turn.generationError) {
        messages.push({
          ...transcript.failure(turn.generationError),
          generationUsage: turn.generationUsage,
        });
        continue;
      }
      if (!turn.content) continue;
      output = { source: turn.content, messages: previewMessages };
      messages.push({
        kind: 'output',
        text: 'A2UI Express',
        payload: turn.content,
        generationUsage: turn.generationUsage,
      });
    }
    return {
      messages,
      output,
      metrics,
    };
  },
  persist(output, context) {
    return {
      assistantContent: output.source,
      a2uiMessages: output.messages,
      previewMessages: output.messages,
      previewPayloadUrls: context.previewPayloadUrls,
    };
  },
  transcript,
  examples: {
    items: [],
    item: (example: never) => example,
    load: (example: never) => example,
  },
  preview: {
    delivery: 'live-message',
    source: (output, context) =>
      A2UI_CHAT_ADAPTER.preview.source(output?.messages ?? null, context),
    initialOutput: (): ExpressOutput => ({ source: '', messages: [] }),
    merge: (current, next) => ({
      source: next.source,
      messages: [...(current?.messages ?? []), ...next.messages],
    }),
    livePayload: output => output.messages,
    artifact: output => ({
      title: 'A2UI Express',
      views: [
        {
          id: 'source',
          label: 'Express',
          language: 'text',
          text: output.source,
        },
        {
          id: 'messages',
          label: 'A2UI messages',
          language: 'json',
          text: JSON.stringify(output.messages, null, 2),
        },
      ],
    }),
    emptyTitle: 'Send a message to generate UI',
    emptySubtitle: 'Generated components will appear here',
    generatingHint: 'The preview updates as Express components compile.',
    emptyHint: 'Generate a surface to preview it.',
  },
  action: {
    ...A2UI_CHAT_ADAPTER.action,
    request: context =>
      expressRequest(
        context,
        JSON.stringify({
          message: context.action.envelope
            ?? { version: '1.0', action: context.action.action },
          metadata: context.action.metadata,
        }),
      ),
    // An action generates a replacement surface. Replay the validated result
    // atomically so loading it cannot patch the previous surface mid-turn.
    stream: {
      ...stream,
      reduce: (state, frame) =>
        frame.event === 'message'
          ? { state, emissions: [] }
          // This reduces an SSE frame, not an array.
          // eslint-disable-next-line unicorn/no-array-callback-reference
          : stream.reduce(state, frame),
    },
    merge: (_current, next) => next,
  },
} satisfies ChatProtocolAdapter<
  ExpressOutput,
  string,
  ProviderSettings,
  never,
  A2UIAction
>;
