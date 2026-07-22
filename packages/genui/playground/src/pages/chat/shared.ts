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

export const PROVIDER_PRESETS = [
  { id: 'gpt-5.4', label: 'gpt5.4', model: 'gpt-5.4' },
  { id: 'gpt-5.5', label: 'gpt5.5', model: 'gpt-5.5' },
  { id: 'custom', label: 'Custom API key', model: '' },
] as const;

export type ProviderPresetId = (typeof PROVIDER_PRESETS)[number]['id'];

export interface ProviderSettings {
  preset: ProviderPresetId;
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface ProviderRequestOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export interface PersistedProviderSettings {
  baseURL: string;
  model: string;
  preset?: ProviderPresetId;
}

const DEFAULT_PROVIDER_SETTINGS: Readonly<ProviderSettings> = {
  preset: 'gpt-5.5',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-5.5',
};

export const EMPTY_CHAT_TOKEN_USAGE: Readonly<ChatTokenUsage> = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function createDefaultProviderSettings(): ProviderSettings {
  return { ...DEFAULT_PROVIDER_SETTINGS };
}

export function isProviderPresetId(
  value: unknown,
): value is ProviderPresetId {
  return PROVIDER_PRESETS.some((item) => item.id === value);
}

export function parseProviderSettings(value: unknown): ProviderSettings {
  if (!value || typeof value !== 'object') {
    return createDefaultProviderSettings();
  }

  const record = value as Partial<Record<keyof ProviderSettings, unknown>>;
  return {
    preset: isProviderPresetId(record.preset)
      ? record.preset
      : DEFAULT_PROVIDER_SETTINGS.preset,
    apiKey: '',
    baseURL: typeof record.baseURL === 'string'
      ? record.baseURL
      : DEFAULT_PROVIDER_SETTINGS.baseURL,
    model: typeof record.model === 'string'
      ? record.model
      : DEFAULT_PROVIDER_SETTINGS.model,
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
    baseURL: settings.baseURL,
    model: settings.model,
    preset: settings.preset,
  };
}

export function compactProviderLabel(settings: ProviderSettings): string {
  if (settings.preset === 'custom') {
    const customModel = settings.model.trim();
    return customModel.length > 0 ? customModel : 'Custom model';
  }
  const preset = PROVIDER_PRESETS.find((item) => item.id === settings.preset);
  return preset?.model ?? 'Server default';
}

export function toProviderRequestOptions(
  settings: ProviderSettings,
): ProviderRequestOptions {
  if (settings.preset !== 'custom') {
    const preset = PROVIDER_PRESETS.find((item) => item.id === settings.preset);
    return preset?.model ? { model: preset.model } : {};
  }

  const apiKey = settings.apiKey.trim();
  const baseURL = settings.baseURL.trim();
  const model = settings.model.trim();
  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(model ? { model } : {}),
  };
}

export const CHAT_PROVIDER_SETTINGS_ADAPTER = {
  storageKeys: [
    CHAT_PROVIDER_SETTINGS_STORAGE_KEY,
    LEGACY_A2UI_PROVIDER_SETTINGS_STORAGE_KEY,
  ],
  initial: createDefaultProviderSettings,
  parseStored: parseStoredProviderSettings,
  serialize: serializeProviderSettings,
  controls(settings) {
    const controls = [
      {
        id: 'preset',
        label: 'Provider preset',
        value: settings.preset,
        kind: 'select' as const,
        options: PROVIDER_PRESETS.map((preset) => ({
          value: preset.id,
          label: preset.label,
        })),
      },
    ];
    if (settings.preset !== 'custom') return controls;
    return [
      ...controls,
      {
        id: 'baseURL',
        label: 'Provider base URL',
        value: settings.baseURL,
        kind: 'text' as const,
        placeholder: 'Base URL',
      },
      {
        id: 'model',
        label: 'Provider model',
        value: settings.model,
        kind: 'text' as const,
        placeholder: 'Model',
      },
      {
        id: 'apiKey',
        label: 'Provider API key',
        value: settings.apiKey,
        kind: 'password' as const,
        placeholder: 'API key for local endpoint',
      },
    ];
  },
  update(settings, id, next) {
    if (id === 'preset' && isProviderPresetId(next)) {
      return { ...settings, preset: next };
    }
    if (id === 'apiKey' || id === 'baseURL' || id === 'model') {
      return { ...settings, [id]: next };
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

export function canForwardApiKeyToEndpoint(
  raw: string,
  host: Pick<ChatHost, 'origin'>,
): boolean {
  try {
    const endpoint = new URL(raw, host.origin);
    return endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_GENUI_SERVER_PORT
      && isDevHost(endpoint.hostname);
  } catch {
    return false;
  }
}

export function filterProviderRequestOptionsForEndpoint(
  options: ProviderRequestOptions,
  endpoint: string,
  host: Pick<ChatHost, 'origin'>,
): ProviderRequestOptions {
  if (canForwardApiKeyToEndpoint(endpoint, host)) return options;
  const { apiKey: _apiKey, ...safeOptions } = options;
  return safeOptions;
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
