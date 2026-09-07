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
import { LYNX_XML_SCENARIOS } from '../demos/lynx-xml.js';
import type { LynxXmlScenario } from '../demos/lynx-xml.js';

export interface LynxXmlOutput {
  source: string;
}

export interface LynxXmlStreamState {
  generatedText: string;
  source: string;
}

const DOCTYPE = '<!doctype lynx>';
const ROOT_END = '</lynx>';
const MAIN_THREAD_START = '<script thread="main">';
const LOCAL_EXAMPLE_PROMPT_PREFIX = 'Load local Lynx XML example: ';

const WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'Describe the interface you want. I will stream a complete zero-build .lynxml artifact and render it directly in Lynx Preview.',
};

const SUGGESTIONS = [
  {
    label: '🌤️ Weather dashboard',
    text:
      'Create an interactive weather dashboard for Shanghai with current conditions, a five-day forecast, and a unit toggle. Use only self-contained data and Lynx-native shapes.',
  },
  {
    label: '✅ Habit tracker',
    text:
      'Create a polished daily habit tracker with progress, four tappable habits, and a reset action. Make it responsive and keep all interaction on the main thread.',
  },
  {
    label: '🎵 Music player',
    text:
      'Create a compact music-player interface with a self-contained album-art treatment, track metadata, progress, and working previous, play/pause, and next controls.',
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep partial source visible as soon as the canonical document begins. */
export function extractLynxXmlSource(value: string): string {
  const start = value.indexOf(DOCTYPE);
  if (start === -1) return '';
  const end = value.lastIndexOf(ROOT_END);
  return value.slice(
    start,
    end >= start ? end + ROOT_END.length : undefined,
  ).trimEnd();
}

export function isCompleteLynxXmlSource(source: string): boolean {
  return source.startsWith(DOCTYPE)
    && source.includes('<lynx engine-version="')
    && source.includes(MAIN_THREAD_START)
    && source.trimEnd().endsWith(ROOT_END);
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
      : 'Lynx XML generation failed');
}

function requireCompleteOutput(value: unknown, fallback = ''): LynxXmlOutput {
  const source = extractLynxXmlSource(readResponseText(value, fallback));
  if (!isCompleteLynxXmlSource(source)) {
    throw new Error('The agent returned an incomplete Lynx XML artifact');
  }
  return { source };
}

function streamStep(
  state: LynxXmlStreamState,
  emissions: readonly ChatStreamEmission<LynxXmlOutput>[] = [],
): ChatStreamStep<LynxXmlStreamState, LynxXmlOutput> {
  return { state, emissions };
}

export const LYNX_XML_STREAM = {
  initial(): LynxXmlStreamState {
    return { generatedText: '', source: '' };
  },
  reduce(
    state: LynxXmlStreamState,
    frame: { event: string; data: unknown },
  ): ChatStreamStep<LynxXmlStreamState, LynxXmlOutput> {
    if (frame.event === 'error') {
      throw new Error(normalizeError(frame.data));
    }

    if (frame.event === 'delta') {
      const delta = isRecord(frame.data) && typeof frame.data.text === 'string'
        ? frame.data.text
        : '';
      if (!delta) return streamStep(state);
      const generatedText = state.generatedText + delta;
      const source = extractLynxXmlSource(generatedText);
      const nextState = { generatedText, source };
      const emissions: ChatStreamEmission<LynxXmlOutput>[] = [
        { type: 'progress', text: source || generatedText },
      ];
      if (source) emissions.push({ type: 'partial', output: { source } });
      return streamStep(nextState, emissions);
    }

    if (frame.event !== 'done') return streamStep(state);

    const output = requireCompleteOutput(frame.data, state.generatedText);
    const emissions: ChatStreamEmission<LynxXmlOutput>[] = [];
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
    const emissions: ChatStreamEmission<LynxXmlOutput>[] = [];
    const usage = isRecord(payload) ? parseTokenUsage(payload.usage) : null;
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep(
      { generatedText: output.source, source: output.source },
      emissions,
    );
  },
  finish(state: LynxXmlStreamState): LynxXmlOutput | null {
    return isCompleteLynxXmlSource(state.source)
      ? { source: state.source }
      : null;
  },
  error: normalizeError,
};

function formatCharacterCount(source: string): string {
  return `${source.length.toLocaleString()} chars`;
}

function generatedStatus(output: LynxXmlOutput): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text: `Generated a complete Lynx XML artifact (${
      formatCharacterCount(output.source)
    }). Lynx Preview is rendering it now.`,
  };
}

function localExampleStatus(title: string): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'zap',
    text: `Loaded local Lynx XML example ${title}. No API call was made.`,
  };
}

function localExampleTitle(content: string): string | null {
  if (!content.startsWith(LOCAL_EXAMPLE_PROMPT_PREFIX)) return null;
  return content.slice(LOCAL_EXAMPLE_PROMPT_PREFIX.length).trim() || null;
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
): ChatHydration<LynxXmlOutput> {
  if (history.length === 0) {
    return { messages: [{ ...WELCOME_MESSAGE }], output: null };
  }

  const messages: ChatMessageModel[] = [{ ...WELCOME_MESSAGE }];
  let output: LynxXmlOutput | null = null;
  let pendingLocalTitle: string | null = null;
  for (const message of history) {
    if (message.role === 'user') {
      pendingLocalTitle = localExampleTitle(message.content);
      messages.push({ kind: 'user', text: message.content });
      continue;
    }
    if (message.role !== 'assistant') continue;
    const source = extractLynxXmlSource(message.content);
    if (!isCompleteLynxXmlSource(source)) continue;
    output = { source };
    messages.push(
      pendingLocalTitle
        ? localExampleStatus(pendingLocalTitle)
        : generatedStatus(output),
    );
    pendingLocalTitle = null;
  }

  const metrics = lastMetrics(history);
  return {
    messages,
    output,
    ...(metrics ? { metrics } : {}),
  };
}

function createArtifact(output: LynxXmlOutput): ChatArtifact {
  return {
    title: 'Generated Lynx XML Artifact',
    meta: `.lynxml · ${formatCharacterCount(output.source)}`,
    views: [{
      id: 'source',
      label: 'Source',
      text: output.source,
      language: 'text',
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
      'Describe a Vanilla Lynx interface, watch its .lynxml source stream in real time, and render the complete zero-build artifact in Lynx Preview.',
    inputAriaLabel: 'Describe the Lynx XML interface to generate',
    inputPlaceholder:
      'Describe the layout, data, visual style, and interactions for your Lynx XML artifact...',
    agentLabel: 'Lynx XML Agent',
    progressLabel: 'Streaming Lynx XML from the GenUI server...',
    failurePrefix: 'Lynx XML generation failed',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return {
      url: getChatEndpoint('lynx-xml', host, settings),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: {
        resourceId: 'lynx-xml-create',
        messages: [{ role: 'user', content: prompt }],
        conversation,
        ...toProviderRequestOptions(settings),
      },
    };
  },
  stream: LYNX_XML_STREAM,
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
        text: 'Streaming Lynx XML from the GenUI server...',
      };
    },
    progress(text) {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: `Streaming Lynx XML from the GenUI server... ${
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
        text: `Lynx XML generation failed: ${error}`,
      };
    },
  },
  examples: {
    items: LYNX_XML_SCENARIOS,
    item(scenario: LynxXmlScenario) {
      return {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
      };
    },
    load(scenario: LynxXmlScenario) {
      const output = { source: scenario.source };
      const userText = `${LOCAL_EXAMPLE_PROMPT_PREFIX}${scenario.title}`;
      return {
        userText,
        messages: [
          { ...WELCOME_MESSAGE },
          { kind: 'user', text: userText },
          localExampleStatus(scenario.title),
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
    emptySubtitle: 'The complete .lynxml artifact will render here',
    generatingHint:
      'The .lynxml source is streaming into the artifact panel. Preview starts as soon as the complete document arrives.',
    emptyHint:
      'No Lynx XML artifact yet. Send a prompt or load a local example to begin.',
  },
} satisfies ChatProtocolAdapter<
  LynxXmlOutput,
  LynxXmlStreamState,
  ProviderSettings,
  LynxXmlScenario
>;
