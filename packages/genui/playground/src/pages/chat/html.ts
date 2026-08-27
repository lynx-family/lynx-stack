// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  getChatEndpoint,
  parseTokenUsage,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import type {
  ChatArtifact,
  ChatHydration,
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatStreamEmission,
  ChatStreamStep,
  ChatTurnPersistence,
} from './type.js';
import type { ModelChatMessage } from '../../hooks/useConversation.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';

export interface HtmlOutput {
  source: string;
}

export interface HtmlStreamState {
  generatedText: string;
  source: string;
}

const HTML_DOCTYPE_PATTERN = /<!doctype\s+html\s*>/iu;
const HTML_ROOT_END = '</html>';

const WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'Describe the web interface you want. I will stream a complete, standalone HTML document and render it in an isolated Web Preview.',
};

const SUGGESTIONS = [
  {
    label: '📊 Analytics dashboard',
    text:
      'Create a responsive analytics dashboard with summary cards, a CSS chart, recent activity, and a working date-range control. Keep everything in one HTML file.',
  },
  {
    label: '🛍️ Product page',
    text:
      'Create a polished mobile-first product page with an inline product illustration, variant selection, quantity controls, and an add-to-cart confirmation.',
  },
  {
    label: '✅ Task planner',
    text:
      'Create an interactive task planner with filters, completion toggles, progress, and an add-task form. Use only self-contained HTML, CSS, and JavaScript.',
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep partial source visible as soon as the HTML document begins. */
export function extractHtmlSource(value: string): string {
  const match = HTML_DOCTYPE_PATTERN.exec(value);
  if (!match || match.index === undefined) return '';

  const source = value.slice(match.index);
  const end = source.toLowerCase().lastIndexOf(HTML_ROOT_END);
  return source.slice(
    0,
    end === -1 ? undefined : end + HTML_ROOT_END.length,
  ).trimEnd();
}

export function isCompleteHtmlSource(source: string): boolean {
  const doctype = HTML_DOCTYPE_PATTERN.exec(source);
  if (!doctype || doctype.index !== 0) return false;
  const documentSource = source.slice(doctype[0].length).trimStart();
  return /^<html(?:\s|>)/iu.test(documentSource)
    && /<head(?:\s|>)/iu.test(documentSource)
    && /<body(?:\s|>)/iu.test(documentSource)
    && source.trimEnd().toLowerCase().endsWith(HTML_ROOT_END);
}

function readResponseText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.text === 'string') return value.text;
  return fallback;
}

function normalizeError(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.error === 'string') return value.error;
    if (isRecord(value.error) && typeof value.error.message === 'string') {
      return value.error.message;
    }
    if (typeof value.message === 'string') return value.message;
  }
  return value instanceof Error
    ? value.message
    : (typeof value === 'string' && value
      ? value
      : 'HTML generation failed');
}

function requireCompleteOutput(value: unknown, fallback = ''): HtmlOutput {
  const source = extractHtmlSource(readResponseText(value, fallback));
  if (!isCompleteHtmlSource(source)) {
    throw new Error('The agent returned an incomplete HTML document');
  }
  return { source };
}

function streamStep(
  state: HtmlStreamState,
  emissions: readonly ChatStreamEmission<HtmlOutput>[] = [],
): ChatStreamStep<HtmlStreamState, HtmlOutput> {
  return { state, emissions };
}

export const HTML_STREAM = {
  initial(): HtmlStreamState {
    return { generatedText: '', source: '' };
  },
  reduce(
    state: HtmlStreamState,
    frame: { event: string; data: unknown },
  ): ChatStreamStep<HtmlStreamState, HtmlOutput> {
    if (frame.event === 'error') {
      throw new Error(normalizeError(frame.data));
    }

    if (frame.event === 'delta') {
      const delta = isRecord(frame.data) && typeof frame.data.text === 'string'
        ? frame.data.text
        : '';
      if (!delta) return streamStep(state);
      const generatedText = state.generatedText + delta;
      const source = extractHtmlSource(generatedText);
      const nextState = { generatedText, source };
      const emissions: ChatStreamEmission<HtmlOutput>[] = [
        { type: 'progress', text: source || generatedText },
      ];
      if (source) emissions.push({ type: 'partial', output: { source } });
      return streamStep(nextState, emissions);
    }

    if (frame.event !== 'done') return streamStep(state);

    const output = requireCompleteOutput(frame.data, state.generatedText);
    const emissions: ChatStreamEmission<HtmlOutput>[] = [];
    const usage = isRecord(frame.data)
      ? parseTokenUsage(frame.data.usage)
      : null;
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep(
      { generatedText: output.source, source: output.source },
      emissions,
    );
  },
  fromJson(payload: unknown) {
    const output = requireCompleteOutput(payload);
    const emissions: ChatStreamEmission<HtmlOutput>[] = [];
    const usage = isRecord(payload) ? parseTokenUsage(payload.usage) : null;
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep(
      { generatedText: output.source, source: output.source },
      emissions,
    );
  },
  finish(state: HtmlStreamState): HtmlOutput | null {
    return isCompleteHtmlSource(state.source)
      ? { source: state.source }
      : null;
  },
  error: normalizeError,
};

function formatCharacterCount(source: string): string {
  return `${source.length.toLocaleString()} chars`;
}

function generatedStatus(output: HtmlOutput): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text: `Generated a complete HTML document (${
      formatCharacterCount(output.source)
    }). Web Preview is rendering it now.`,
  };
}

function lastMetrics(
  history: readonly ModelChatMessage[],
): PreviewPerformanceMetrics | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const metrics = history[index]?.previewMetrics;
    if (metrics) return metrics;
  }
  return undefined;
}

function hydrate(
  history: readonly ModelChatMessage[],
): ChatHydration<HtmlOutput> {
  if (history.length === 0) {
    return { messages: [{ ...WELCOME_MESSAGE }], output: null };
  }

  const messages: ChatMessageModel[] = [{ ...WELCOME_MESSAGE }];
  let output: HtmlOutput | null = null;
  for (const message of history) {
    if (message.role === 'user') {
      messages.push({ kind: 'user', text: message.content });
      continue;
    }
    if (message.role !== 'assistant') continue;
    const source = extractHtmlSource(message.content);
    if (!isCompleteHtmlSource(source)) continue;
    output = { source };
    messages.push(generatedStatus(output));
  }

  const metrics = lastMetrics(history);
  return {
    messages,
    output,
    ...(metrics ? { metrics } : {}),
  };
}

function createArtifact(output: HtmlOutput): ChatArtifact {
  return {
    title: 'Generated HTML Document',
    meta: `.html · ${formatCharacterCount(output.source)}`,
    views: [{
      id: 'source',
      label: 'Source',
      text: output.source,
      language: 'text',
    }],
  };
}

function persistOutput(output: HtmlOutput): ChatTurnPersistence {
  return {
    assistantContent: output.source,
    a2uiMessages: [],
    previewMessages: [],
  };
}

export const HTML_CHAT_ADAPTER = {
  id: 'html',
  copy: {
    description:
      'Describe a web interface, watch its single-file HTML source stream in real time, and render the complete document in an isolated iframe.',
    inputAriaLabel: 'Describe the HTML interface to generate',
    inputPlaceholder:
      'Describe the layout, content, visual style, and interactions for your HTML document...',
    agentLabel: 'HTML Agent',
    progressLabel: 'Streaming HTML from the GenUI server...',
    failurePrefix: 'HTML generation failed',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return {
      url: getChatEndpoint('html', host),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: {
        resourceId: 'html-create',
        messages: [{ role: 'user', content: prompt }],
        conversation,
        ...toProviderRequestOptions(settings),
      },
    };
  },
  stream: HTML_STREAM,
  hydrate({ history }) {
    return hydrate(history);
  },
  persist(output) {
    return persistOutput(output);
  },
  transcript: {
    pending() {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: 'Streaming HTML from the GenUI server...',
      };
    },
    progress(text) {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: `Streaming HTML from the GenUI server... ${
          formatCharacterCount(text)
        }`,
      };
    },
    success(output) {
      return [generatedStatus(output)];
    },
    failure(error) {
      return {
        kind: 'status',
        tone: 'error',
        icon: 'error',
        text: `HTML generation failed: ${error}`,
      };
    },
  },
  examples: {
    items: [],
    item(example: never) {
      return example;
    },
    load(example: never) {
      return example;
    },
  },
  preview: {
    delivery: 'reload',
    source(output, context) {
      return output
        ? {
          kind: 'html',
          source: output.source,
          theme: context.theme,
        }
        : undefined;
    },
    artifact: createArtifact,
    merge(_current, next) {
      return next;
    },
    emptyTitle: 'Send a prompt to generate HTML',
    emptySubtitle: 'The complete HTML document will render here',
    generatingHint:
      'The HTML source is streaming into the artifact panel. Preview starts as soon as the complete document arrives.',
    emptyHint:
      'No HTML document yet. Send a prompt to generate a self-contained web interface.',
  },
} satisfies ChatProtocolAdapter<
  HtmlOutput,
  HtmlStreamState,
  ProviderSettings
>;
