// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  normalizeLynxXmlOutput,
  validateLynxXml,
} from '@lynx-js/genui/lynx-xml';

import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  filterProviderRequestOptionsForEndpoint,
  getChatEndpoint,
  parseTokenUsage,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import type {
  ChatArtifact,
  ChatHost,
  ChatHttpRequest,
  ChatHydration,
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatStreamAdapter,
  ChatStreamEmission,
  ChatStreamStep,
  ChatTurnPersistence,
} from './type.js';
import type {
  ConversationContext,
  ModelChatMessage,
} from '../../hooks/useConversation.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';

export interface LynxXmlOutput {
  source: string;
  title: string;
}

export interface LynxXmlStreamState {
  finalText?: string;
}

interface LynxXmlExample {
  id: string;
  title: string;
  description: string;
  prompt: string;
  source: string;
}

const WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'Describe a native Lynx interface. I will generate one zero-build XML artifact with Lynx CSS and Element PAPI JavaScript, then run it directly in Lynx Preview.',
};

const SUGGESTIONS = [
  {
    label: 'Travel itinerary',
    text:
      'Create a polished five-day Hangzhou travel itinerary with a hero, trip summary, scrollable day cards, and tappable selection feedback.',
  },
  {
    label: 'Fitness dashboard',
    text:
      'Create a dark fitness dashboard with daily rings, weekly progress, workout cards, and a tappable start-workout action.',
  },
  {
    label: 'Music player',
    text:
      'Create an elegant music player with album art, current track metadata, a progress bar, transport controls, and a playlist.',
  },
] as const;

const EXAMPLES: LynxXmlExample[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatCharacterCount(value: string): string {
  return `${value.length.toLocaleString()} chars`;
}

function normalizeError(payload: unknown): string {
  if (isRecord(payload)) {
    if (typeof payload.error === 'string') return payload.error;
    if (isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
    if (typeof payload.message === 'string') return payload.message;
  }
  if (payload instanceof Error) return payload.message;
  return typeof payload === 'string' && payload
    ? payload
    : 'Lynx XML generation failed';
}

function createOutput(source: string, title: string): LynxXmlOutput {
  const validation = validateLynxXml(source);
  if (!validation.ok) {
    throw new Error(`Invalid Lynx XML: ${validation.errors.join('; ')}`);
  }
  return { source: validation.source, title };
}

function getLastMetrics(
  history: readonly ModelChatMessage[],
): PreviewPerformanceMetrics | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const metrics = history[index]?.previewMetrics;
    if (metrics) return metrics;
  }
  return undefined;
}

function hydrateLynxXml(
  history: readonly ModelChatMessage[],
): ChatHydration<LynxXmlOutput> {
  const messages: ChatMessageModel[] = [{ ...WELCOME_MESSAGE }];
  let output: LynxXmlOutput | null = null;

  for (const message of history) {
    if (message.role === 'user') {
      messages.push({ kind: 'user', text: message.content });
      continue;
    }
    if (message.role !== 'assistant') continue;
    try {
      output = createOutput(message.content, 'Saved artifact');
      messages.push({
        kind: 'status',
        tone: 'success',
        icon: 'sparkles',
        text: 'Generated a validated Lynx XML artifact.',
      });
    } catch {
      // Ignore an obsolete or incomplete stored response.
    }
  }

  const metrics = getLastMetrics(history);
  return {
    messages,
    output,
    ...(metrics ? { metrics } : {}),
  };
}

function createRequest(
  prompt: string,
  conversation: ConversationContext,
  settings: ProviderSettings,
  host: ChatHost,
): ChatHttpRequest {
  const endpoint = getChatEndpoint('lynx-xml', host);
  const providerOptions = filterProviderRequestOptionsForEndpoint(
    toProviderRequestOptions(settings),
    endpoint,
    host,
  );
  return {
    url: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      resourceId: 'lynx-xml-create',
      messages: [{ role: 'user', content: prompt }],
      conversation,
      ...providerOptions,
    },
  };
}

function streamStep(
  state: LynxXmlStreamState,
  emissions: readonly ChatStreamEmission<LynxXmlOutput>[] = [],
): ChatStreamStep<LynxXmlStreamState, LynxXmlOutput> {
  return { state, emissions };
}

const STREAM: ChatStreamAdapter<LynxXmlStreamState, LynxXmlOutput> = {
  initial: () => ({}),
  reduce(state, frame) {
    if (frame.event === 'error') throw new Error(normalizeError(frame.data));

    // Lynx XML generation is intentionally non-streaming. Ignore stale delta
    // frames from an older server and wait for the validated done frame.
    if (frame.event === 'delta') return streamStep(state);

    if (frame.event !== 'done') return streamStep(state);
    const data = isRecord(frame.data) ? frame.data : {};
    if (typeof data.text !== 'string') {
      throw new Error('The GenUI server returned no completed Lynx XML');
    }
    const finalText = data.text;
    const output = createOutput(finalText, 'Agent response');
    const emissions: ChatStreamEmission<LynxXmlOutput>[] = [
      { type: 'progress', text: output.source },
    ];
    const usage = parseTokenUsage(data.usage);
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep(
      { finalText: output.source },
      emissions,
    );
  },
  fromJson(payload) {
    if (!isRecord(payload) || typeof payload.text !== 'string') {
      throw new Error(normalizeError(payload));
    }
    const output = createOutput(payload.text, 'Agent response');
    const emissions: ChatStreamEmission<LynxXmlOutput>[] = [
      { type: 'progress', text: output.source },
    ];
    const usage = parseTokenUsage(payload.usage);
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep(
      { finalText: output.source },
      emissions,
    );
  },
  finish(state) {
    const source = normalizeLynxXmlOutput(state.finalText ?? '');
    return source ? createOutput(source, 'Agent response') : null;
  },
  error: normalizeError,
};

function createArtifact(output: LynxXmlOutput): ChatArtifact {
  return {
    title: 'Generated Lynx XML',
    meta: `${output.title} - ${formatCharacterCount(output.source)}`,
    views: [{
      id: 'xml',
      label: 'XML',
      text: output.source,
      language: 'xml',
    }],
  };
}

function persistOutput(output: LynxXmlOutput): ChatTurnPersistence {
  return {
    assistantContent: output.source,
    a2uiMessages: [],
    previewMessages: [],
  };
}

export const LYNX_XML_CHAT_ADAPTER = {
  id: 'lynx-xml',
  copy: {
    description:
      'Generate Lynx CSS and Element PAPI JavaScript directly as one zero-build XML artifact.',
    inputAriaLabel: 'Describe the native Lynx interface to generate',
    inputPlaceholder:
      'Describe the mobile interface, content, layout, and interactions you want...',
    agentLabel: 'Lynx XML Agent',
    progressLabel: 'Generating and validating Lynx XML...',
    failurePrefix: 'Lynx XML generation failed',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return createRequest(prompt, conversation, settings, host);
  },
  stream: STREAM,
  hydrate({ history }) {
    return hydrateLynxXml(history);
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
        text: 'Generating the complete Lynx XML artifact...',
      };
    },
    progress(text) {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: `Validating the completed Lynx XML artifact... ${
          formatCharacterCount(text)
        }`,
      };
    },
    success() {
      return [{
        kind: 'status',
        tone: 'success',
        icon: 'sparkles',
        text:
          'Generated and validated a zero-build Lynx XML artifact. Lynx Preview is running the source directly.',
      }];
    },
    failure(error) {
      return {
        kind: 'status',
        tone: 'error',
        icon: 'error',
        text: `Lynx XML generation failed: ${error}`,
      };
    },
  },
  examples: {
    items: EXAMPLES,
    item(example) {
      return {
        id: example.id,
        title: example.title,
        description: example.description,
      };
    },
    load(example) {
      const output = createOutput(example.source, example.title);
      return {
        userText: example.prompt,
        messages: [
          { ...WELCOME_MESSAGE },
          { kind: 'user', text: example.prompt },
          {
            kind: 'status',
            tone: 'success',
            icon: 'sparkles',
            text: `Loaded local Lynx XML example ${example.title}.`,
          },
        ],
        output,
        persistence: persistOutput(output),
      };
    },
  },
  preview: {
    delivery: 'reload',
    source(output, context) {
      return output
        ? {
          kind: 'lynx-xml',
          source: output.source,
          theme: context.theme,
        }
        : undefined;
    },
    artifact: createArtifact,
    merge(_current, next) {
      return next;
    },
    emptyTitle: 'Send a prompt to generate Lynx XML',
    emptySubtitle: 'The generated Element PAPI source will run directly here',
    generatingHint:
      'Waiting for the complete source artifact. Preview starts only after XML validation passes.',
    emptyHint:
      'No Lynx XML artifact yet. Send a prompt to generate and preview one.',
  },
} satisfies ChatProtocolAdapter<
  LynxXmlOutput,
  LynxXmlStreamState,
  ProviderSettings,
  LynxXmlExample
>;
