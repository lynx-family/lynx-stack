// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ChatHost,
  ChatSettingsAdapter,
  ChatSseEvent,
  ChatTokenUsage,
} from './type.js';
import type { ProtocolName } from '../../utils/protocol.js';
import { isDevHost } from '../../utils/publishPayload.js';

export const ONLINE_GENUI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
export const LOCAL_GENUI_SERVER_PORT = '3060';

export const CHAT_PROVIDER_SETTINGS_STORAGE_KEY =
  'genui-playground-provider-settings';
export const LEGACY_A2UI_PROVIDER_SETTINGS_STORAGE_KEY =
  'a2ui-playground-provider-settings';

export interface ProviderModel {
  id: string;
  label: string;
}

export interface ProviderSettings {
  model: string;
  models: readonly ProviderModel[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
}

export interface ProviderRequestOptions {
  model?: string;
}

export interface PersistedProviderSettings {
  model: string;
}

const DEFAULT_PROVIDER_SETTINGS: Readonly<ProviderSettings> = {
  model: '',
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
  const isLegacyDefault = record.preset === 'gpt-5.5'
    && record.baseURL === 'https://api.openai.com/v1'
    && record.model === 'gpt-5.5';
  return {
    ...createDefaultProviderSettings(),
    model: !isLegacyDefault && typeof record.model === 'string'
      ? record.model
      : '',
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
  return { model: settings.model };
}

export function compactProviderLabel(settings: ProviderSettings): string {
  return settings.models.find((item) => item.id === settings.model)?.label
    ?? (settings.status === 'error' ? 'Models unavailable' : 'Loading models');
}

export function toProviderRequestOptions(
  settings: ProviderSettings,
): ProviderRequestOptions {
  const model = settings.model.trim();
  return model ? { model } : {};
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
      ? [{ id: model.id, label: model.label }]
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

export function getModelsEndpoint(host: ChatHost): string {
  const endpoint = new URL(getChatEndpoint('a2ui', host));
  endpoint.pathname = '/models';
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.toString();
}

export async function loadProviderSettings(
  settings: ProviderSettings,
  host: ChatHost,
  signal: AbortSignal,
): Promise<ProviderSettings> {
  try {
    const response = await window.fetch(getModelsEndpoint(host), {
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
    return {
      model: models.some((item) => item.id === settings.model)
        ? settings.model
        : defaultModel,
      models,
      status: 'ready',
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      ...settings,
      models: [],
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const CHAT_PROVIDER_SETTINGS_ADAPTER = {
  storageKeys: [
    CHAT_PROVIDER_SETTINGS_STORAGE_KEY,
    LEGACY_A2UI_PROVIDER_SETTINGS_STORAGE_KEY,
  ],
  initial: createDefaultProviderSettings,
  parseStored: parseStoredProviderSettings,
  serialize: serializeProviderSettings,
  load: loadProviderSettings,
  controls(settings) {
    return [
      {
        id: 'model',
        label: 'Model',
        value: settings.model,
        kind: 'select' as const,
        disabled: settings.status !== 'ready',
        options: settings.models.length > 0
          ? settings.models.map((model) => ({
            value: model.id,
            label: model.label,
          }))
          : [{
            value: '',
            label: settings.status === 'error'
              ? (settings.error ?? 'Models unavailable')
              : 'Loading models...',
          }],
      },
    ];
  },
  update(settings, id, next) {
    if (id === 'model' && settings.models.some((item) => item.id === next)) {
      return { ...settings, model: next };
    }
    return settings;
  },
  badge: compactProviderLabel,
} satisfies ChatSettingsAdapter<ProviderSettings>;

export function parseTokenUsage(value: unknown): ChatTokenUsage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const pickNumber = (...keys: string[]): number => {
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
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
  return { promptTokens, completionTokens, totalTokens };
}

export function addTokenUsage(
  current: ChatTokenUsage,
  next: ChatTokenUsage,
): ChatTokenUsage {
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens,
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
    if (endpoint.origin === ONLINE_GENUI_SERVER_ORIGIN) {
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
): string {
  const fromQuery = new URLSearchParams(host.search).get(
    `${protocol}Endpoint`,
  );
  if (fromQuery) {
    const trustedEndpoint = resolveTrustedChatEndpoint(fromQuery, host);
    if (trustedEndpoint) return trustedEndpoint;
  }
  if (host.protocol === 'http:' && isDevHost(host.hostname)) {
    return `http://${host.hostname}:${LOCAL_GENUI_SERVER_PORT}/${protocol}/stream`;
  }
  return `${ONLINE_GENUI_SERVER_ORIGIN}/${protocol}/stream`;
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
