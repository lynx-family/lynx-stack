// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
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
import {
  OPENUI_SCENARIOS,
  parseOpenUIScenarioRaw,
} from '../../mock/openui-scenarios.js';
import type { OpenUIScenario } from '../../mock/openui-scenarios.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';

export interface OpenUIOutput {
  rawText: string;
  scenarioTitle: string;
}

export interface OpenUIStreamState {
  generatedText: string;
  finalText?: string;
}

export interface OpenUIActionEvent {
  type: string;
  params: Record<string, unknown>;
  humanFriendlyMessage: string;
  formName?: string;
  formState?: Record<string, unknown>;
}

const WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'Describe the OpenUI surface you want to create. I will stream OpenUI Lang from the GenUI server and render the result in Lynx Preview.',
};

const SUGGESTIONS = [
  {
    label: 'Weather query',
    text:
      'Create an OpenUI weather card for Seattle with live query data, a refresh action, metrics, and alerts.',
  },
  {
    label: 'Pricing picker',
    text:
      'Create an OpenUI pricing page with three plans, selected state, billing controls, and reset actions.',
  },
  {
    label: 'Pizza order',
    text:
      'Create an OpenUI pizza order card with options, a summary, and an order action.',
  },
] as const;

const LOCAL_SCENARIO_PROMPT_PREFIX = 'Load local OpenUI scenario: ';
const OPENUI_ACTION_MESSAGE_TYPES = new Set([
  'A2UI_USER_ACTION',
  'OPENUI_USER_ACTION',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatCharacterCount(value: string): string {
  return `${value.length.toLocaleString()} chars`;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeErrorPayload(payload: unknown): string {
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
    : 'OpenUI generation failed';
}

function createOutput(rawText: string, scenarioTitle: string): OpenUIOutput {
  return { rawText, scenarioTitle };
}

function createGeneratedStatus(): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text:
      'Generated OpenUI Lang from the server agent. The Lynx Preview is rendering the final response.',
  };
}

function createLoadedScenarioStatus(title: string): ChatMessageModel {
  return {
    kind: 'status',
    tone: 'success',
    icon: 'sparkles',
    text: `Loaded local OpenUI scenario ${title}. No API call was made.`,
  };
}

function localScenarioTitleFromPrompt(content: string): string | null {
  if (!content.startsWith(LOCAL_SCENARIO_PROMPT_PREFIX)) return null;
  const title = content.slice(LOCAL_SCENARIO_PROMPT_PREFIX.length).trim();
  return title || null;
}

function buildMessagesFromHistory(
  history: readonly ModelChatMessage[],
): ChatMessageModel[] {
  if (history.length === 0) return [{ ...WELCOME_MESSAGE }];

  const messages: ChatMessageModel[] = [{ ...WELCOME_MESSAGE }];
  let previousScenarioTitle: string | null = null;
  for (const message of history) {
    if (message.role === 'user') {
      previousScenarioTitle = localScenarioTitleFromPrompt(message.content);
      messages.push({ kind: 'user', text: message.content });
      continue;
    }
    if (message.role !== 'assistant') continue;
    messages.push(
      previousScenarioTitle
        ? createLoadedScenarioStatus(previousScenarioTitle)
        : createGeneratedStatus(),
    );
    previousScenarioTitle = null;
  }
  return messages;
}

function getLastOutput(
  history: readonly ModelChatMessage[],
): OpenUIOutput | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];
    if (message?.role !== 'assistant') continue;
    const rawText = message.content.trim();
    if (!rawText) continue;
    const previousUser = history
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user');
    const scenarioTitle = previousUser
      ? localScenarioTitleFromPrompt(previousUser.content) ?? 'Saved response'
      : 'Saved response';
    return createOutput(rawText, scenarioTitle);
  }
  return null;
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

function hydrateOpenUI(
  history: readonly ModelChatMessage[],
): ChatHydration<OpenUIOutput> {
  const metrics = getLastMetrics(history);
  return {
    messages: buildMessagesFromHistory(history),
    output: getLastOutput(history),
    ...(metrics ? { metrics } : {}),
  };
}

function createOpenUIRequest(
  prompt: string,
  conversation: ConversationContext,
  settings: ProviderSettings,
  host: ChatHost,
): ChatHttpRequest {
  const endpoint = getChatEndpoint('openui', host);
  const providerOptions = filterProviderRequestOptionsForEndpoint(
    toProviderRequestOptions(settings),
    endpoint,
    host,
  );
  return {
    url: endpoint,
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: {
      resourceId: 'openui-create',
      messages: [{ role: 'user' as const, content: prompt }],
      conversation,
      ...providerOptions,
    },
  };
}

function streamStep(
  state: OpenUIStreamState,
  emissions: readonly ChatStreamEmission<OpenUIOutput>[] = [],
): ChatStreamStep<OpenUIStreamState, OpenUIOutput> {
  return { state, emissions };
}

function createOpenUIStreamAdapter(
  scenarioTitle: string,
): ChatStreamAdapter<OpenUIStreamState, OpenUIOutput> {
  return {
    initial: () => ({ generatedText: '' }),
    reduce(state, frame) {
      if (frame.event === 'error') {
        throw new Error(normalizeErrorPayload(frame.data));
      }

      if (frame.event === 'delta') {
        const data = isRecord(frame.data) ? frame.data : {};
        if (typeof data.text !== 'string') return streamStep(state);
        const generatedText = state.generatedText + data.text;
        const nextState = { ...state, generatedText };
        return streamStep(nextState, [{
          type: 'progress',
          text: generatedText,
        }]);
      }

      if (frame.event !== 'done') return streamStep(state);

      const data = isRecord(frame.data) ? frame.data : {};
      const finalText = typeof data.text === 'string'
        ? data.text
        : state.generatedText;
      if (!finalText.trim()) {
        throw new Error('OpenUI agent returned no output');
      }

      const output = createOutput(finalText, scenarioTitle);
      const emissions: ChatStreamEmission<OpenUIOutput>[] = [
        { type: 'progress', text: finalText },
      ];
      const usage = parseTokenUsage(data.usage);
      if (usage) emissions.push({ type: 'usage', usage });
      emissions.push({ type: 'final', output });
      return streamStep(
        { generatedText: state.generatedText, finalText },
        emissions,
      );
    },
    fromJson(payload) {
      if (!isRecord(payload) || typeof payload.text !== 'string') {
        throw new Error(normalizeErrorPayload(payload));
      }
      const finalText = payload.text;
      if (!finalText.trim()) {
        throw new Error('OpenUI agent returned no output');
      }
      const output = createOutput(finalText, scenarioTitle);
      const emissions: ChatStreamEmission<OpenUIOutput>[] = [
        { type: 'progress', text: finalText },
      ];
      const usage = parseTokenUsage(payload.usage);
      if (usage) emissions.push({ type: 'usage', usage });
      emissions.push({ type: 'final', output });
      return streamStep({ generatedText: finalText, finalText }, emissions);
    },
    finish(state) {
      const finalText = state.finalText ?? state.generatedText;
      return finalText.trim() ? createOutput(finalText, scenarioTitle) : null;
    },
    error: normalizeErrorPayload,
  };
}

const CREATE_STREAM = createOpenUIStreamAdapter('Agent response');
const ACTION_STREAM = createOpenUIStreamAdapter('Action response');

function parseActionEvent(value: unknown): OpenUIActionEvent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.type !== 'string'
    || typeof value.humanFriendlyMessage !== 'string'
    || !isRecord(value.params)
  ) {
    return null;
  }

  return {
    type: value.type,
    params: value.params,
    humanFriendlyMessage: value.humanFriendlyMessage,
    ...(typeof value.formName === 'string'
      ? { formName: value.formName }
      : {}),
    ...(isRecord(value.formState) ? { formState: value.formState } : {}),
  };
}

function parseActionWindowMessage(data: unknown): OpenUIActionEvent | null {
  if (!isRecord(data) || !OPENUI_ACTION_MESSAGE_TYPES.has(String(data.type))) {
    return null;
  }
  return parseActionEvent(data.action ?? data.event);
}

function actionLabel(action: OpenUIActionEvent): string {
  const label = action.humanFriendlyMessage.trim();
  return label || action.type;
}

function actionUserText(action: OpenUIActionEvent): string {
  const label = actionLabel(action);
  const context = {
    type: action.type,
    params: action.params,
    ...(action.formName ? { formName: action.formName } : {}),
    ...(action.formState ? { formState: action.formState } : {}),
  };
  return `${label}\n\nOpenUI action context:\n${stringifyValue(context)}`;
}

function createArtifact(output: OpenUIOutput): ChatArtifact {
  let parsedText: string;
  try {
    parsedText = parseOpenUIScenarioRaw(output.rawText);
  } catch (error) {
    parsedText = `Unable to parse OpenUI DSL:\n${String(error)}`;
  }

  return {
    title: 'Generated OpenUI Output',
    meta: `${output.scenarioTitle} - ${formatCharacterCount(output.rawText)}`,
    views: [
      {
        id: 'raw',
        label: 'Raw',
        text: output.rawText,
        language: 'text',
      },
      {
        id: 'json',
        label: 'JSON',
        text: parsedText,
        language: 'json',
      },
    ],
  };
}

function persistOutput(output: OpenUIOutput): ChatTurnPersistence {
  return {
    assistantContent: output.rawText,
    a2uiMessages: [],
    previewMessages: [],
  };
}

const EXAMPLES = OPENUI_SCENARIOS.slice(0, 8);

export const OPENUI_CHAT_ADAPTER = {
  id: 'openui',
  copy: {
    description:
      'Describe an OpenUI surface, inspect the generated DSL, and render it in Lynx Preview.',
    inputAriaLabel: 'Describe the OpenUI surface to generate',
    inputPlaceholder:
      'Describe the OpenUI surface, data, state, or interactions you want to generate...',
    agentLabel: 'OpenUI Agent',
    progressLabel: 'Streaming OpenUI Lang from the GenUI server...',
    failurePrefix: 'OpenUI generation failed',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  createRequest({ prompt, conversation, settings, host }) {
    return createOpenUIRequest(prompt, conversation, settings, host);
  },
  stream: CREATE_STREAM,
  hydrate({ history }) {
    return hydrateOpenUI(history);
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
        text: 'Streaming OpenUI Lang from the GenUI server...',
      };
    },
    progress(text) {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: `Streaming OpenUI Lang from the GenUI server... ${
          formatCharacterCount(text)
        }`,
      };
    },
    success() {
      return [createGeneratedStatus()];
    },
    failure(error) {
      return {
        kind: 'status',
        tone: 'error',
        icon: 'error',
        text: `OpenUI generation failed: ${error}`,
      };
    },
  },
  examples: {
    items: EXAMPLES,
    item(scenario: OpenUIScenario) {
      return {
        id: scenario.id,
        title: scenario.title,
        ...(scenario.badge ? { description: scenario.badge } : {}),
      };
    },
    load(scenario: OpenUIScenario) {
      const userText = `${LOCAL_SCENARIO_PROMPT_PREFIX}${scenario.title}`;
      const output = createOutput(scenario.raw, scenario.title);
      return {
        userText,
        messages: [
          { ...WELCOME_MESSAGE },
          { kind: 'user', text: userText },
          createLoadedScenarioStatus(scenario.title),
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
          kind: 'openui',
          rawText: output.rawText,
          theme: context.theme,
          liveAction: true,
        }
        : undefined;
    },
    artifact: createArtifact,
    merge(_current, next) {
      return next;
    },
    emptyTitle: 'Send a prompt to generate OpenUI',
    emptySubtitle: 'Generated OpenUI output will be previewed here',
    generatingHint:
      'Streaming OpenUI output from the GenUI server. The preview will appear when the response is complete.',
    emptyHint:
      'No OpenUI output yet. Send a prompt or load a local scenario to preview it.',
  },
  action: {
    parseWindowMessage: parseActionWindowMessage,
    userText: actionUserText,
    label: actionLabel,
    request({ action, conversation, settings, host }) {
      return createOpenUIRequest(
        actionUserText(action),
        conversation,
        settings,
        host,
      );
    },
    stream: ACTION_STREAM,
    merge(_current, response) {
      return response;
    },
  },
} satisfies ChatProtocolAdapter<
  OpenUIOutput,
  OpenUIStreamState,
  ProviderSettings,
  OpenUIScenario,
  OpenUIActionEvent,
  OpenUIStreamState
>;
