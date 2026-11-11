// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ChatHost,
  ChatHttpRequest,
  ChatSettingsAdapter,
  ChatSseEvent,
  ChatTokenUsage,
} from './type.js';
import {
  GENUI_SERVER_URL,
  assertCustomProviderRequestTarget,
  buildGenuiServerUrl,
} from '../../config/genuiServer.js';
import { readModelPrices } from '../../utils/modelPricing.js';
import type { ModelPrices } from '../../utils/modelPricing.js';
import type { ProtocolName } from '../../utils/protocol.js';
import { isDevHost } from '../../utils/publishPayload.js';

export const LOCAL_GENUI_SERVER_PORT = '3060';

export const CHAT_PROVIDER_SETTINGS_STORAGE_KEY =
  'genui-playground-provider-settings';
export const LEGACY_A2UI_PROVIDER_SETTINGS_STORAGE_KEY =
  'a2ui-playground-provider-settings';
export const CUSTOM_PROVIDER_ID = 'custom';
export const CUSTOM_PROVIDER_BASE_URL_OPTIONS = [
  {
    value: 'https://api.openai.com/v1',
    label: 'OpenAI',
    model: 'gpt-5.6-terra',
  },
  {
    value: 'https://generativelanguage.googleapis.com/v1beta/openai',
    label: 'Google Gemini',
    model: 'gemini-3.7-flash',
  },
  {
    value: 'https://openrouter.ai/api/v1',
    label: 'OpenRouter',
    model: 'openrouter/auto',
  },
] as const;
export const CUSTOM_JEV_PROVIDER_OPTION = {
  value: 'https://api.typesafe.ai/v1',
  label: 'TypeSafe Jev',
  model: 'jev-latest',
} as const;
const COMPOSITION_CUSTOM_PROVIDER_BASE_URL_OPTIONS = [
  ...CUSTOM_PROVIDER_BASE_URL_OPTIONS,
  CUSTOM_JEV_PROVIDER_OPTION,
];
export const CUSTOM_PROVIDER_BASE_URL =
  CUSTOM_PROVIDER_BASE_URL_OPTIONS[0].value;
export const CUSTOM_PROVIDER_MODEL = CUSTOM_PROVIDER_BASE_URL_OPTIONS[0].model;
const MISSING_SERVER_MODEL_CONFIG_ERROR = 'GENUI_MODEL_CONFIG_JSON is required';
const REASONING_EFFORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
] as const;

export type ReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORT_OPTIONS.some((option) =>
    option.value !== '' && option.value === value
  );
}

function getCustomProviderDefaultModel(baseURL: string): string {
  return COMPOSITION_CUSTOM_PROVIDER_BASE_URL_OPTIONS.find(
    (option) => option.value === baseURL,
  )?.model ?? CUSTOM_PROVIDER_MODEL;
}

export interface ProviderModel extends Partial<ModelPrices> {
  id: string;
  label: string;
  composition?: boolean;
}

export interface ProviderSettings {
  enableScriptReuse?: boolean;
  enableDesignGuidance?: boolean;
  enableHtmlFragment?: boolean;
  stylePreset?: 'default' | false;
  reasoningEffort?: ReasoningEffort;
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  models: readonly ProviderModel[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
}

export interface ProviderRequestOptions {
  enableDesignGuidance?: boolean;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface PersistedProviderSettings {
  enableScriptReuse?: boolean;
  enableDesignGuidance?: boolean;
  enableHtmlFragment?: boolean;
  stylePreset?: 'default' | false;
  reasoningEffort?: ReasoningEffort;
  provider: string;
}

const DEFAULT_PROVIDER_SETTINGS: Readonly<ProviderSettings> = {
  provider: '',
  apiKey: '',
  baseURL: CUSTOM_PROVIDER_BASE_URL,
  model: CUSTOM_PROVIDER_MODEL,
  models: [],
  status: 'idle',
};

export const EMPTY_CHAT_TOKEN_USAGE: Readonly<ChatTokenUsage> = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function createDefaultProviderSettings(): ProviderSettings {
  return { ...DEFAULT_PROVIDER_SETTINGS, models: [] };
}

export function parseProviderSettings(value: unknown): ProviderSettings {
  if (!value || typeof value !== 'object') {
    return createDefaultProviderSettings();
  }

  const record = value as Record<string, unknown>;
  const isLegacyCustom = record.preset === 'custom';
  let provider = '';
  if (typeof record.provider === 'string') {
    provider = record.provider;
  } else if (isLegacyCustom) {
    provider = CUSTOM_PROVIDER_ID;
  } else if (
    record.preset === undefined && typeof record.model === 'string'
  ) {
    provider = record.model;
  }
  const enableHtmlFragment = record.enableHtmlFragment
    ?? record.enableHtmlFragmentTool;
  const enableDesignGuidance = record.enableDesignGuidance;
  return {
    ...createDefaultProviderSettings(),
    provider,
    ...(typeof record.enableScriptReuse === 'boolean'
      ? { enableScriptReuse: record.enableScriptReuse }
      : {}),
    ...(record.stylePreset === 'default' || record.stylePreset === false
      ? { stylePreset: record.stylePreset }
      : {}),
    ...(typeof enableHtmlFragment === 'boolean'
      ? { enableHtmlFragment }
      : {}),
    ...(typeof enableDesignGuidance === 'boolean'
      ? { enableDesignGuidance }
      : {}),
    ...(isReasoningEffort(record.reasoningEffort)
      ? { reasoningEffort: record.reasoningEffort }
      : {}),
    // Never restore custom-provider fields from browser storage. Older
    // versions wrote them here, so ignoring them also migrates those values
    // out when the settings are serialized again.
  };
}

export function parseStoredProviderSettings(
  raw: unknown,
): ProviderSettings {
  if (typeof raw !== 'string' || !raw) {
    return createDefaultProviderSettings();
  }
  try {
    return parseProviderSettings(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultProviderSettings();
  }
}

export function serializeProviderSettings(
  settings: ProviderSettings,
): PersistedProviderSettings {
  return {
    provider: settings.provider,
    ...(settings.enableScriptReuse === undefined
      ? {}
      : { enableScriptReuse: settings.enableScriptReuse }),
    ...(settings.stylePreset === undefined
      ? {}
      : { stylePreset: settings.stylePreset }),
    ...(settings.enableDesignGuidance === false
      ? { enableDesignGuidance: false }
      : {}),
    ...(settings.enableHtmlFragment === undefined
      ? {}
      : { enableHtmlFragment: settings.enableHtmlFragment }),
    ...(settings.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: settings.reasoningEffort }),
  };
}

export function compactProviderLabel(settings: ProviderSettings): string {
  if (settings.provider === CUSTOM_PROVIDER_ID) {
    return settings.model.trim() || getCustomProviderDefaultModel(
      settings.baseURL,
    );
  }
  return settings.models.find((item) => item.id === settings.provider)?.label
    ?? (settings.status === 'error' ? 'Models unavailable' : 'Loading models');
}

export function getProviderSettingsValidationError(
  settings: ProviderSettings,
  protocol?: 'a2ui' | 'openui',
): string | undefined {
  if (settings.provider !== CUSTOM_PROVIDER_ID) return undefined;

  if (
    settings.baseURL === CUSTOM_JEV_PROVIDER_OPTION.value && protocol !== 'a2ui'
    && protocol !== 'openui'
  ) {
    return 'TypeSafe Jev is available only in A2UI and OpenUI Create. Select another provider endpoint.';
  }

  const hasModel = settings.model.trim().length > 0;
  const hasApiKey = settings.apiKey.trim().length > 0;
  if (!hasModel && !hasApiKey) {
    return 'Enter a provider model and API key to use Custom API key.';
  }
  if (!hasModel) {
    return 'Enter a provider model to use Custom API key.';
  }
  if (!hasApiKey) {
    return 'Enter a provider API key to use Custom API key.';
  }
  return undefined;
}

export function toProviderRequestOptions(
  settings: ProviderSettings,
  protocol?: 'a2ui' | 'openui',
): ProviderRequestOptions {
  const isCompositionProvider = settings.provider === CUSTOM_PROVIDER_ID
    ? settings.baseURL === CUSTOM_JEV_PROVIDER_OPTION.value
    : settings.models.some((model) =>
      model.id === settings.provider && model.composition === true
    );
  const reasoning = !isCompositionProvider && settings.reasoningEffort
    ? { reasoningEffort: settings.reasoningEffort }
    : {};
  if (settings.provider !== CUSTOM_PROVIDER_ID) {
    const model = settings.provider.trim();
    return {
      ...(model ? { model } : {}),
      ...(settings.enableDesignGuidance === false
        ? { enableDesignGuidance: false }
        : {}),
      ...reasoning,
    };
  }

  const validationError = getProviderSettingsValidationError(
    settings,
    protocol,
  );
  if (validationError) throw new Error(validationError);

  const apiKey = settings.apiKey.trim();
  const baseURL = settings.baseURL.trim() || CUSTOM_PROVIDER_BASE_URL;
  const model = settings.model.trim();
  return {
    apiKey,
    baseURL,
    model,
    ...(settings.enableDesignGuidance === false
      ? { enableDesignGuidance: false }
      : {}),
    ...reasoning,
  };
}

function parseModelsResponse(value: unknown): {
  defaultModel: string;
  models: ProviderModel[];
} {
  if (!value || typeof value !== 'object') {
    throw new Error('The model list response is invalid');
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.defaultModel !== 'string' || !Array.isArray(record.models)
  ) {
    throw new Error('The model list response is invalid');
  }
  const models = record.models.flatMap((item): ProviderModel[] => {
    if (!item || typeof item !== 'object') return [];
    const model = item as Record<string, unknown>;
    return typeof model.id === 'string' && typeof model.label === 'string'
      ? [{
        id: model.id,
        label: model.label,
        ...readModelPrices(model),
        ...(model.composition === true ? { composition: true } : {}),
      }]
      : [];
  });
  if (
    models.length !== record.models.length
    || !models.some((item) => item.id === record.defaultModel)
  ) {
    throw new Error('The model list response is invalid');
  }
  return { defaultModel: record.defaultModel, models };
}

export function getModelsEndpoint(
  host: ChatHost,
  protocol?: 'a2ui' | 'openui',
): string {
  const endpoint = new URL(getChatEndpoint('a2ui', host));
  endpoint.pathname = '/models';
  endpoint.search = '';
  if (protocol) endpoint.searchParams.set('protocol', protocol);
  endpoint.hash = '';
  return endpoint.toString();
}

export async function loadProviderSettings(
  settings: ProviderSettings,
  host: ChatHost,
  signal: AbortSignal,
  protocol?: 'a2ui' | 'openui',
): Promise<ProviderSettings> {
  try {
    const response = await window.fetch(getModelsEndpoint(host, protocol), {
      headers: { Accept: 'application/json' },
      signal,
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>).error
        : undefined;
      throw new Error(
        typeof error === 'string' ? error : 'Failed to load model list',
      );
    }
    const { defaultModel, models } = parseModelsResponse(payload);
    const canKeepProvider = models.some((item) => item.id === settings.provider)
      || settings.provider === CUSTOM_PROVIDER_ID;
    return {
      ...settings,
      provider: canKeepProvider ? settings.provider : defaultModel,
      models,
      status: 'ready',
    };
  } catch (error) {
    if (signal.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message === MISSING_SERVER_MODEL_CONFIG_ERROR) {
      const next = {
        ...settings,
        provider: CUSTOM_PROVIDER_ID,
        models: [],
        status: 'ready' as const,
      };
      delete next.error;
      return next;
    }
    return {
      ...settings,
      models: [],
      status: 'error',
      error: message,
    };
  }
}

export function createProviderSettingsAdapter(protocol?: 'a2ui' | 'openui') {
  const endpoints = protocol === 'a2ui' || protocol === 'openui'
    ? COMPOSITION_CUSTOM_PROVIDER_BASE_URL_OPTIONS
    : CUSTOM_PROVIDER_BASE_URL_OPTIONS;
  return {
    storageKeys: [
      CHAT_PROVIDER_SETTINGS_STORAGE_KEY,
      LEGACY_A2UI_PROVIDER_SETTINGS_STORAGE_KEY,
    ],
    initial: createDefaultProviderSettings,
    parseStored: parseStoredProviderSettings,
    serialize: serializeProviderSettings,
    conversation: {
      snapshot: (settings) => ({
        ...(settings.provider ? { provider: settings.provider } : {}),
        enableDesignGuidance: settings.enableDesignGuidance !== false,
        ...(settings.reasoningEffort
          ? { reasoningEffort: settings.reasoningEffort }
          : {}),
      }),
      restore: (settings, saved) => ({
        ...settings,
        ...(saved.provider
            && (settings.status !== 'ready'
              || saved.provider === CUSTOM_PROVIDER_ID
              || settings.models.some(model => model.id === saved.provider))
          ? { provider: saved.provider }
          : {}),
        enableDesignGuidance: saved.enableDesignGuidance,
        reasoningEffort: saved.reasoningEffort,
      }),
    },
    load: (settings, host, signal) =>
      loadProviderSettings(settings, host, signal, protocol),
    usageModel: (settings) => ({
      model: settings.provider === CUSTOM_PROVIDER_ID
        ? settings.model
        : settings.provider,
      modelPrices: settings.provider === CUSTOM_PROVIDER_ID
        ? undefined
        : readModelPrices(
          settings.models.find(model => model.id === settings.provider),
        ),
    }),
    controls(settings) {
      const customOption = {
        value: CUSTOM_PROVIDER_ID,
        label: 'Custom API key',
      };
      let providerOptions;
      if (settings.status === 'ready') {
        providerOptions = [
          ...settings.models.map((model) => ({
            value: model.id,
            label: model.label,
          })),
          customOption,
        ];
      } else if (settings.provider === CUSTOM_PROVIDER_ID) {
        providerOptions = [customOption];
      } else {
        providerOptions = [{
          value: '',
          label: settings.status === 'error'
            ? (settings.error ?? 'Models unavailable')
            : 'Loading models...',
        }];
      }
      const providerControl = {
        id: 'provider',
        label: 'Provider',
        value: settings.provider,
        kind: 'select' as const,
        disabled: settings.status !== 'ready',
        options: providerOptions,
      };
      const designControl = {
        id: 'enableDesignGuidance',
        label: 'Design',
        value: settings.enableDesignGuidance === false ? 'off' : 'on',
        kind: 'checkbox' as const,
      };
      const isCompositionProvider = settings.provider === CUSTOM_PROVIDER_ID
        ? settings.baseURL === CUSTOM_JEV_PROVIDER_OPTION.value
        : settings.models.some((model) =>
          model.id === settings.provider && model.composition === true
        );
      const reasoningControl = {
        id: 'reasoningEffort',
        label: 'Reasoning',
        description: 'Override the selected model reasoning effort.',
        value: settings.reasoningEffort ?? '',
        kind: 'select' as const,
        options: REASONING_EFFORT_OPTIONS,
      };
      if (settings.provider !== CUSTOM_PROVIDER_ID) {
        return [
          providerControl,
          ...(isCompositionProvider ? [] : [reasoningControl]),
          designControl,
        ];
      }
      return [
        providerControl,
        {
          id: 'model',
          label: 'Provider model',
          value: settings.model,
          kind: 'text' as const,
          placeholder: getCustomProviderDefaultModel(settings.baseURL),
        },
        {
          id: 'apiKey',
          label: 'Provider API key',
          value: settings.apiKey,
          kind: 'password' as const,
          placeholder: 'sk-...',
        },
        {
          id: 'baseURL',
          label: 'Provider endpoint',
          value: settings.baseURL,
          kind: 'select' as const,
          options: endpoints,
        },
        ...(isCompositionProvider ? [] : [reasoningControl]),
        designControl,
      ];
    },
    update(settings, id, next) {
      if (id === 'enableDesignGuidance') {
        return { ...settings, enableDesignGuidance: next !== 'off' };
      }
      if (id === 'reasoningEffort') {
        if (next === '') {
          const updated = { ...settings };
          delete updated.reasoningEffort;
          return updated;
        }
        return isReasoningEffort(next)
          ? { ...settings, reasoningEffort: next }
          : settings;
      }
      if (
        id === 'provider'
        && (settings.models.some((item) => item.id === next)
          || next === CUSTOM_PROVIDER_ID)
      ) {
        return { ...settings, provider: next };
      }
      if (settings.provider === CUSTOM_PROVIDER_ID && id === 'baseURL') {
        const option = endpoints.find(
          ({ value }) => value === next,
        );
        if (option) {
          return { ...settings, baseURL: option.value, model: option.model };
        }
      }
      if (
        settings.provider === CUSTOM_PROVIDER_ID
        && (id === 'apiKey' || id === 'model')
      ) {
        return { ...settings, [id]: next };
      }
      return settings;
    },
    validate: settings =>
      getProviderSettingsValidationError(settings, protocol),
    validateRequest: assertProviderRequestTarget,
    badge: compactProviderLabel,
  } satisfies ChatSettingsAdapter<ProviderSettings>;
}

export const CHAT_PROVIDER_SETTINGS_ADAPTER = createProviderSettingsAdapter();

function readTokenCount(value: unknown): number | undefined {
  const candidate = value && typeof value === 'object'
    ? (value as Record<string, unknown>).total
    : value;
  return typeof candidate === 'number' && Number.isFinite(candidate)
      && candidate >= 0
    ? candidate
    : undefined;
}

function findCacheTokenCount(
  value: unknown,
  keys: readonly string[],
): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const count = readTokenCount(record[key]);
    if (count !== undefined) return count;
  }
  for (const nested of Object.values(record)) {
    const count = findCacheTokenCount(nested, keys);
    if (count !== undefined) return count;
  }
  return undefined;
}

export function parseTokenUsage(value: unknown): ChatTokenUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const pickNumber = (...keys: string[]): number => {
    for (const key of keys) {
      const count = readTokenCount(record[key]);
      if (count !== undefined) return count;
    }
    return 0;
  };

  const promptTokens = pickNumber(
    'promptTokens',
    'inputTokens',
    'input_tokens',
    'prompt_tokens',
  );
  const completionTokens = pickNumber(
    'completionTokens',
    'outputTokens',
    'output_tokens',
    'completion_tokens',
  );
  const totalTokens = pickNumber('totalTokens', 'total_tokens')
    || promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }
  const cachedTokens = findCacheTokenCount(record, [
    'cached_tokens',
    'cachedTokens',
    'cached_input_tokens',
    'cachedInputTokens',
    'cacheReadTokens',
    'cacheRead',
    'cache_read_input_tokens',
  ]);
  const cacheWriteTokens = findCacheTokenCount(record, [
    'cache_write_tokens',
    'cacheWriteTokens',
    'cacheWrite',
    'cache_creation_input_tokens',
  ]);
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    ...(cachedTokens === undefined ? {} : { cachedTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  };
}

export function addTokenUsage(
  current: ChatTokenUsage,
  next: ChatTokenUsage,
): ChatTokenUsage {
  const addCacheTokens = (
    key: 'cachedTokens' | 'cacheWriteTokens',
  ): number | undefined => {
    // Missing usage from any model call must not become a reported cache miss.
    if (
      (current.totalTokens > 0 && current[key] === undefined)
      || (next.totalTokens > 0 && next[key] === undefined)
    ) return undefined;
    return (current[key] ?? 0) + (next[key] ?? 0);
  };
  const cachedTokens = addCacheTokens('cachedTokens');
  const cacheWriteTokens = addCacheTokens('cacheWriteTokens');
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens,
    ...(cachedTokens === undefined ? {} : { cachedTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  };
}

export function formatTokenCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(2)}k`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function parseSseData(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function parseSseFrame(frame: string): ChatSseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/u)) {
    if (!line || line.startsWith(':')) continue;
    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1
      ? line
      : line.slice(0, separatorIndex);
    const value = separatorIndex === -1
      ? ''
      : line.slice(separatorIndex + 1).replace(/^ /u, '');
    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: parseSseData(dataLines.join('\n')) };
}

export function createChatRequestInit(
  request: ChatHttpRequest,
  signal: AbortSignal,
): RequestInit {
  const body = request.body === undefined
    ? undefined
    : (typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body));
  return {
    method: request.method ?? 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...request.headers,
    },
    body,
    signal,
  };
}

export function createChatHost(
  location: Pick<
    Location,
    'href' | 'hostname' | 'origin' | 'protocol' | 'search'
  >,
): ChatHost {
  return {
    origin: location.origin,
    hostname: location.hostname,
    protocol: location.protocol,
    search: location.search,
    baseUrl: location.href.replace(/#.*$/u, ''),
  };
}

export function resolveTrustedChatEndpoint(
  raw: string,
  host: Pick<ChatHost, 'origin'>,
): string | null {
  try {
    const endpoint = new URL(raw, host.origin);
    if (endpoint.origin === host.origin) return endpoint.toString();
    if (endpoint.origin === GENUI_SERVER_URL) {
      return endpoint.toString();
    }

    const isTrustedDevEndpoint = endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_GENUI_SERVER_PORT
      && isDevHost(endpoint.hostname);
    return isTrustedDevEndpoint ? endpoint.toString() : null;
  } catch {
    return null;
  }
}

export function getChatEndpoint(
  protocol: ProtocolName,
  host: ChatHost,
  settings?: ProviderSettings,
): string {
  if (settings?.provider === CUSTOM_PROVIDER_ID) {
    const endpoint = buildGenuiServerUrl(`${protocol}/stream`);
    assertCustomProviderRequestTarget(endpoint);
    return endpoint;
  }

  const fromQuery = new URLSearchParams(host.search).get(
    `${protocol}Endpoint`,
  );
  if (fromQuery) {
    const trustedEndpoint = resolveTrustedChatEndpoint(fromQuery, host);
    if (trustedEndpoint) return trustedEndpoint;
  }
  return buildGenuiServerUrl(`${protocol}/stream`);
}

export function assertProviderRequestTarget(
  settings: ProviderSettings,
  target: string,
): void {
  if (settings.provider === CUSTOM_PROVIDER_ID) {
    assertCustomProviderRequestTarget(target);
  }
}

export function getA2UIActionEndpoint(chatEndpoint: string): string {
  return chatEndpoint.replace(/\/a2ui\/stream$/u, '/a2ui/action/stream');
}

export function targetOriginForUrl(
  raw: string,
  host: Pick<ChatHost, 'origin'>,
): string {
  try {
    return new URL(raw, host.origin).origin;
  } catch {
    return host.origin;
  }
}
