// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  filterProviderRequestOptionsForEndpoint,
  getA2UIActionEndpoint,
  getChatEndpoint,
  parseTokenUsage,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import type {
  ChatHydration,
  ChatHydrationContext,
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatStreamEmission,
  ChatStreamStep,
} from './type.js';
import { EXTENDED_STATIC_DEMOS, OFFICIAL_STATIC_DEMOS } from '../../demos.js';
import type { StaticDemo } from '../../demos.js';
import type { ModelChatMessage } from '../../hooks/useConversation.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';
import { DEFAULT_A2UI_DEMO_URL } from '../../utils/demoUrl.js';

export type A2UIOutput = unknown[];

export interface A2UIStreamState {
  generatedText: string;
  messages: A2UIOutput;
}

export interface A2UIAction {
  action: Record<string, unknown>;
  surfaceId?: string;
}

interface A2UIDonePayload {
  text?: unknown;
  errors?: unknown;
  validation?: {
    messages?: unknown;
    errors?: unknown;
  };
  error?: unknown;
  message?: unknown;
  messages?: unknown;
  usage?: unknown;
  cachedTokens?: unknown;
  preview?: {
    messagesUrl?: unknown;
    actionMocksUrl?: unknown;
  };
}

interface PersistedA2UIAction {
  action: Record<string, unknown>;
  name: string;
}

const WELCOME_TEXT =
  'I\'m A2UI Assistant. Describe the UI you want to build and I\'ll generate A2UI JSON for you.';

const SUGGESTIONS = [
  {
    label: '🌤️ Weather with Refresh',
    text:
      'Create a weather card for San Francisco showing sunny, a photo, 22°C, humidity 60%, and a "Refresh" button. When the user taps Refresh, update the card with slightly different weather data to simulate a live fetch.',
  },
  {
    label: '🛍️ Product card with Buy',
    text:
      'Create a product card for a limited-edition sneaker. Include name, a photo, price ($189), a short description, and a "Buy Now" button. When tapped, show a purchase confirmation step with a "Confirm Purchase" button. Only the Confirm Purchase button should submit the action; after the action response, replace the card with an order success page showing a fake order number and estimated delivery.',
  },
  {
    label: '⚡ Quiz card with actions',
    text:
      'Create a trivia quiz card. Show a question "Which shape has three sides?" with 4 answer buttons: Triangle, Square, Circle, Hexagon. When the user taps an answer, show whether it is correct with a brief explanation.',
  },
] as const;

const FEATURED_EXAMPLES: readonly StaticDemo[] = (() => {
  const featured = [...EXTENDED_STATIC_DEMOS];
  for (const demo of OFFICIAL_STATIC_DEMOS) {
    if (featured.length >= 12) break;
    if (!featured.some((item) => item.id === demo.id)) featured.push(demo);
  }
  return featured;
})();

function welcomeMessage(): ChatMessageModel {
  return { kind: 'assistant', text: WELCOME_TEXT };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatCharacterCount(count: number): string {
  return `${count.toLocaleString()} char${count === 1 ? '' : 's'}`;
}

function generatedCharacterCount(value: unknown): number {
  return safeStringify(value).length;
}

function renderedPreviewText(
  messageCount: number,
  characterCount: number,
): string {
  return `✅ Rendered ${messageCount} A2UI message${
    messageCount === 1 ? '' : 's'
  } (${formatCharacterCount(characterCount)}) to Lynx Preview`;
}

function generatedOutputMessage(payload: unknown): ChatMessageModel {
  return {
    kind: 'output',
    text: 'Generated Output',
    payload,
    payloadLayout: 'chunks',
  };
}

function normalizeErrorPayload(payload: unknown): string {
  if (isRecord(payload)) {
    const record = payload as A2UIDonePayload;
    if (Array.isArray(record.errors)) {
      const errors = record.errors.filter((item): item is string =>
        typeof item === 'string'
      );
      if (errors.length > 0) return errors.join(' ');
    }
    if (Array.isArray(record.validation?.errors)) {
      const errors = record.validation.errors.filter(
        (item): item is string => typeof item === 'string',
      );
      if (errors.length > 0) return errors.join(' ');
    }
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return payload instanceof Error ? payload.message : String(payload);
}

function normalizeMessages(payload: unknown): A2UIOutput {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') {
    try {
      return normalizeMessages(JSON.parse(payload) as unknown);
    } catch {
      return [];
    }
  }
  if (!isRecord(payload)) return [];

  const record = payload as A2UIDonePayload;
  if (Array.isArray(record.messages) && record.messages.length > 0) {
    return record.messages;
  }
  if (
    Array.isArray(record.validation?.messages)
    && record.validation.messages.length > 0
  ) {
    return record.validation.messages;
  }
  return typeof record.text === 'string'
    ? normalizeMessages(record.text)
    : [];
}

function normalizePreviewPayload(payload: unknown) {
  if (!isRecord(payload)) return null;
  const preview = (payload as A2UIDonePayload).preview;
  if (!isRecord(preview) || typeof preview.messagesUrl !== 'string') {
    return null;
  }
  return {
    messagesUrl: preview.messagesUrl,
    ...(typeof preview.actionMocksUrl === 'string'
      ? { actionMocksUrl: preview.actionMocksUrl }
      : {}),
  };
}

function metadataEmissions(
  payload: unknown,
): ChatStreamEmission<A2UIOutput>[] {
  if (!isRecord(payload)) return [];
  const record = payload as A2UIDonePayload;
  const emissions: ChatStreamEmission<A2UIOutput>[] = [];
  const usage = parseTokenUsage(record.usage, record.cachedTokens);
  if (usage) emissions.push({ type: 'usage', usage });
  const preview = normalizePreviewPayload(payload);
  if (preview) emissions.push({ type: 'previewPayload', value: preview });
  return emissions;
}

function streamStep(
  state: A2UIStreamState,
  emissions: readonly ChatStreamEmission<A2UIOutput>[],
): ChatStreamStep<A2UIStreamState, A2UIOutput> {
  return { state, emissions };
}

const A2UI_STREAM = {
  initial(): A2UIStreamState {
    return { generatedText: '', messages: [] };
  },
  reduce(
    state: A2UIStreamState,
    frame: { event: string; data: unknown },
  ): ChatStreamStep<A2UIStreamState, A2UIOutput> {
    if (frame.event === 'delta') {
      const delta = isRecord(frame.data) && typeof frame.data.text === 'string'
        ? frame.data.text
        : '';
      if (!delta) return streamStep(state, []);
      const generatedText = state.generatedText + delta;
      return streamStep(
        { ...state, generatedText },
        [{ type: 'progress', text: generatedText }],
      );
    }

    if (frame.event === 'message') {
      const nextMessages = normalizeMessages(frame.data);
      if (nextMessages.length === 0) return streamStep(state, []);
      const nextState = {
        ...state,
        messages: [...state.messages, ...nextMessages],
      };
      // A2UI `message` SSE frames contain only the newly parsed protocol
      // messages. Keep `partial.output` incremental; ChatController combines
      // it with the current preview through `preview.merge` below.
      return streamStep(nextState, [
        { type: 'partial', output: nextMessages },
      ]);
    }

    if (frame.event === 'done') {
      const output = normalizeMessages(frame.data);
      const metadata = metadataEmissions(frame.data);
      if (output.length === 0) {
        throw new Error(normalizeErrorPayload(frame.data));
      }
      return streamStep(
        { ...state, messages: output },
        [...metadata, { type: 'final', output }],
      );
    }

    if (frame.event === 'error') {
      throw new Error(normalizeErrorPayload(frame.data));
    }

    return streamStep(state, []);
  },
  fromJson(payload: unknown): ChatStreamStep<A2UIStreamState, A2UIOutput> {
    const output = normalizeMessages(payload);
    if (output.length === 0) {
      throw new Error(normalizeErrorPayload(payload));
    }
    return streamStep(
      { generatedText: safeStringify(payload), messages: output },
      [...metadataEmissions(payload), { type: 'final', output }],
    );
  },
  finish(state: A2UIStreamState): A2UIOutput | null {
    if (state.messages.length > 0) return state.messages;
    const output = normalizeMessages(state.generatedText);
    return output.length > 0 ? output : null;
  },
  error: normalizeErrorPayload,
};

function includesCreateSurface(messages: readonly unknown[]): boolean {
  return messages.some((message) =>
    isRecord(message) && Boolean(message.createSurface)
  );
}

function outputFromHistory(history: readonly ModelChatMessage[]): A2UIOutput {
  return history.flatMap((message) =>
    message.role === 'assistant' ? normalizeMessages(message.content) : []
  );
}

function parsePersistedAction(content: string): PersistedA2UIAction | null {
  const prefix = 'A2UI_USER_ACTION:';
  if (!content.startsWith(prefix)) return null;
  try {
    const parsed = JSON.parse(content.slice(prefix.length).trim()) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.action)) return null;
    const action = parsed.action;
    const event = isRecord(action.event) ? action.event : null;
    return {
      action,
      name: typeof action.name === 'string'
        ? action.name
        : (event && typeof event.name === 'string' ? event.name : 'unknown'),
    };
  } catch {
    return null;
  }
}

function hasMetrics(
  metrics: PreviewPerformanceMetrics | undefined,
): metrics is PreviewPerformanceMetrics {
  if (!metrics) return false;
  return Object.values(metrics).some((value) =>
    typeof value === 'number' && Number.isFinite(value)
  );
}

function lastMetrics(
  history: readonly ModelChatMessage[],
): PreviewPerformanceMetrics {
  for (let index = history.length - 1; index >= 0; index--) {
    const metrics = history[index]?.previewMetrics;
    if (hasMetrics(metrics)) return metrics;
  }
  return {};
}

function agentRespondedMessage(
  count: number,
  metrics?: PreviewPerformanceMetrics,
): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text: `Agent responded with ${count} A2UI ${
      count === 1 ? 'message' : 'messages'
    }.`,
    ...(metrics ? { metrics } : {}),
  };
}

function hydrateMessages(
  history: readonly ModelChatMessage[],
): ChatMessageModel[] {
  if (history.length === 0) return [welcomeMessage()];

  const messages: ChatMessageModel[] = [welcomeMessage()];
  let previousWasAction = false;
  for (const message of history) {
    if (message.role === 'user') {
      const persistedAction = parsePersistedAction(message.content);
      if (persistedAction) {
        messages.push(
          {
            kind: 'status',
            side: 'right',
            tone: 'info',
            text:
              `📤 Lynx Preview triggered ${persistedAction.name}, forwarding request to agent...`,
            code: persistedAction.name,
          },
          {
            kind: 'action',
            text: `⚡ Action: ${persistedAction.name}`,
            payload: persistedAction.action,
            payloadLayout: 'single',
          },
        );
        previousWasAction = true;
        continue;
      }
      messages.push({ kind: 'user', text: message.content });
      previousWasAction = false;
      continue;
    }

    if (message.role !== 'assistant') continue;
    const output = normalizeMessages(message.content);
    if (previousWasAction && output.length > 0) {
      messages.push(
        agentRespondedMessage(output.length, message.previewMetrics),
        {
          kind: 'output',
          tone: 'success',
          text: 'LLM Response',
          payload: output,
          payloadLayout: 'chunks',
        },
        {
          kind: 'status',
          tone: 'info',
          text: '✨ UI updated. Ready for the next action.',
        },
      );
      previousWasAction = false;
      continue;
    }

    if (output.length > 0) {
      messages.push({
        kind: 'status',
        tone: 'success',
        text: renderedPreviewText(
          output.length,
          generatedCharacterCount(message.content),
        ),
      });
      if (hasMetrics(message.previewMetrics)) {
        messages.push({
          kind: 'status',
          tone: 'info',
          text: '📊 Preview metrics captured for this response.',
          metrics: message.previewMetrics,
        });
      }
    }
    messages.push(generatedOutputMessage(message.content));
    previousWasAction = false;
  }
  return messages;
}

function hydrate(context: ChatHydrationContext): ChatHydration<A2UIOutput> {
  const persistedPreview = context.previewMessages;
  const output = includesCreateSurface(persistedPreview)
    ? persistedPreview
    : outputFromHistory(context.history);
  return {
    messages: hydrateMessages(context.history),
    output: output.length > 0 ? output : null,
    metrics: lastMetrics(context.history),
  };
}

function mergeOutput(
  current: A2UIOutput | null,
  next: A2UIOutput,
): A2UIOutput {
  return [...(current ?? []), ...next];
}

function actionLabel(action: A2UIAction): string {
  const event = isRecord(action.action.event) ? action.action.event : null;
  return typeof action.action.name === 'string'
    ? action.action.name
    : (event && typeof event.name === 'string' ? event.name : 'unknown');
}

export const A2UI_CHAT_ADAPTER = {
  id: 'a2ui',
  copy: {
    description:
      'Describe the UI you want to build. Share the structure, interactions, or visual style you want to explore.',
    inputAriaLabel: 'Describe the UI to generate',
    inputPlaceholder:
      'Describe the UI, interaction, data, or style you want to generate...',
    agentLabel: 'Online Agent',
    progressLabel: 'Connecting to A2UI agent...',
    failurePrefix: 'Generation failed:',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    const url = getChatEndpoint('a2ui', host);
    const provider = filterProviderRequestOptionsForEndpoint(
      toProviderRequestOptions(settings),
      url,
      host,
    );
    return {
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        messages: [{ role: 'user', content: prompt }],
        conversation,
        ...provider,
      },
    };
  },
  stream: A2UI_STREAM,
  hydrate,
  persist(output, context) {
    const isAction = context.kind === 'action';
    return {
      assistantContent: JSON.stringify(output),
      a2uiMessages: output,
      previewMessages: isAction
        ? mergeOutput(context.current, output)
        : output,
      previewPayloadUrls: isAction ? null : context.previewPayloadUrls,
      ...(isAction ? { snapshotPreviewPayloadUrls: null } : {}),
    };
  },
  transcript: {
    pending() {
      return {
        kind: 'assistant',
        tone: 'pending',
        icon: 'spinner',
        text: 'Connecting to A2UI agent...',
      };
    },
    progress(text) {
      return {
        kind: 'assistant',
        tone: 'pending',
        icon: 'spinner',
        text: `Streaming A2UI messages (${
          formatCharacterCount(text.length)
        })...`,
      };
    },
    success(output) {
      return [
        {
          kind: 'status',
          tone: 'success',
          text: renderedPreviewText(
            output.length,
            generatedCharacterCount(output),
          ),
        },
        generatedOutputMessage(output),
      ];
    },
    failure(error) {
      return {
        kind: 'assistant',
        tone: 'error',
        icon: 'error',
        text: `Generation failed: ${error}`,
      };
    },
  },
  examples: {
    items: FEATURED_EXAMPLES,
    item(example) {
      return {
        id: example.id,
        title: example.title,
        ...(example.description ? { description: example.description } : {}),
      };
    },
    load(example) {
      const output = Array.isArray(example.messages)
        ? example.messages
        : [];
      const userText = `Load offline example: ${example.title}${
        example.description ? `. ${example.description}` : ''
      }`;
      return {
        userText,
        output,
        messages: [
          welcomeMessage(),
          {
            kind: 'status',
            tone: 'info',
            text:
              `⚡ Loaded offline example ${example.title} — no API call made.`,
            code: example.title,
          },
          generatedOutputMessage(output),
        ],
        persistence: {
          assistantContent: JSON.stringify(output),
          a2uiMessages: output,
          previewMessages: output,
        },
      };
    },
  },
  preview: {
    delivery: 'live-message',
    source(output, context) {
      if (!output) return undefined;
      return {
        kind: 'a2ui',
        protocol: context.protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        theme: context.theme,
        messages: output,
        messagesUrl: context.previewPayloadUrls?.messagesUrl,
        actionMocksUrl: context.previewPayloadUrls?.actionMocksUrl,
        liveAction: true,
      };
    },
    livePayload(output) {
      return output;
    },
    // Partial A2UI SSE emissions are deltas. The controller must use this
    // capability to accumulate them; a final emission always replaces the
    // accumulated output with the server's complete validated message array.
    merge: mergeOutput,
    emptyTitle: 'Send a message to generate UI',
    emptySubtitle: 'Generated components will be previewed here',
    generatingHint:
      'Generation is in progress. Web Preview and Native Preview links will appear once A2UI data arrives.',
    emptyHint:
      'No A2UI data has been received yet. Send a message to generate Web Preview and Native Preview links.',
  },
  action: {
    parseWindowMessage(data) {
      if (!isRecord(data) || data.type !== 'A2UI_USER_ACTION') return null;
      if (!isRecord(data.action)) return null;
      const surfaceId = typeof data.surfaceId === 'string'
        ? data.surfaceId
        : (typeof data.action.surfaceId === 'string'
          ? data.action.surfaceId
          : undefined);
      return {
        action: data.action,
        ...(surfaceId ? { surfaceId } : {}),
      };
    },
    userText(action) {
      return `A2UI_USER_ACTION: ${
        JSON.stringify({
          surfaceId: action.surfaceId,
          action: action.action,
        })
      }`;
    },
    label: actionLabel,
    request({ action, conversation, settings, host }) {
      const chatEndpoint = getChatEndpoint('a2ui', host);
      const url = getA2UIActionEndpoint(chatEndpoint);
      const provider = filterProviderRequestOptionsForEndpoint(
        toProviderRequestOptions(settings),
        url,
        host,
      );
      return {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: {
          surfaceId: action.surfaceId,
          action: action.action,
          conversation,
          ...provider,
        },
      };
    },
    stream: A2UI_STREAM,
    merge: mergeOutput,
  },
} satisfies ChatProtocolAdapter<
  A2UIOutput,
  A2UIStreamState,
  ProviderSettings,
  StaticDemo,
  A2UIAction,
  A2UIStreamState
>;
