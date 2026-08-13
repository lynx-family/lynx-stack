// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { OpenAIReasoningEffort } from './types.js';

export const GENUI_MODEL_CONFIG_ENV = 'GENUI_MODEL_CONFIG_JSON';

const REASONING_EFFORTS = new Set<OpenAIReasoningEffort>([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]);

export interface ConfiguredModel {
  apiKey: string;
  baseURL: string;
  model: string;
  api?: 'chat' | 'responses';
  default?: true;
  reasoningEffort?: OpenAIReasoningEffort;
}

export interface GenUIModelConfig {
  defaultModel: string;
  models: Record<string, ConfiguredModel>;
}

export interface ResolvedModelConfig {
  name: string;
  config: ConfiguredModel;
}

type ModelConfigResult =
  | { ok: true; config: GenUIModelConfig }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function parseConfiguredModel(
  name: string,
  value: unknown,
): ConfiguredModel {
  if (!isRecord(value)) {
    throw new Error(`model ${JSON.stringify(name)} must be an object`);
  }

  const apiKey = requiredString(value, 'apiKey');
  const baseURL = requiredString(value, 'baseURL');
  const model = requiredString(value, 'model');
  let parsedBaseURL: URL;
  try {
    parsedBaseURL = new URL(baseURL);
  } catch {
    throw new Error(
      `model ${JSON.stringify(name)} baseURL must be a valid URL`,
    );
  }
  if (
    parsedBaseURL.protocol !== 'http:' && parsedBaseURL.protocol !== 'https:'
  ) {
    throw new Error(
      `model ${JSON.stringify(name)} baseURL must use http or https`,
    );
  }

  const api = value.api;
  if (api !== undefined && api !== 'chat' && api !== 'responses') {
    throw new Error(
      `model ${JSON.stringify(name)} api must be either chat or responses`,
    );
  }
  const isDefault = value.default;
  if (isDefault !== undefined && typeof isDefault !== 'boolean') {
    throw new Error(`model ${JSON.stringify(name)} default must be a boolean`);
  }
  const reasoningEffort = value.reasoningEffort;
  if (
    reasoningEffort !== undefined
    && !REASONING_EFFORTS.has(reasoningEffort as OpenAIReasoningEffort)
  ) {
    throw new Error(
      `model ${JSON.stringify(name)} reasoningEffort is invalid`,
    );
  }

  return {
    apiKey,
    baseURL,
    model,
    ...(api === undefined ? {} : { api }),
    ...(isDefault === true ? { default: true as const } : {}),
    ...(reasoningEffort === undefined
      ? {}
      : { reasoningEffort: reasoningEffort as OpenAIReasoningEffort }),
  };
}

export function parseModelConfig(raw: string | undefined): GenUIModelConfig {
  if (!raw) {
    throw new Error(`${GENUI_MODEL_CONFIG_ENV} is required`);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${GENUI_MODEL_CONFIG_ENV} must contain valid JSON`);
  }
  if (!isRecord(value)) {
    throw new Error(`${GENUI_MODEL_CONFIG_ENV} must contain a JSON object`);
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error(
      `${GENUI_MODEL_CONFIG_ENV} must configure at least one model`,
    );
  }

  const models = Object.create(null) as Record<string, ConfiguredModel>;
  const defaultModels: string[] = [];
  for (const [name, modelValue] of entries) {
    if (name.trim().length === 0 || name.trim() !== name) {
      throw new Error(
        'model names must be non-empty and have no surrounding whitespace',
      );
    }
    const model = parseConfiguredModel(name, modelValue);
    models[name] = model;
    if (model.default) defaultModels.push(name);
  }
  if (defaultModels.length > 1) {
    throw new Error('only one configured model may be marked as default');
  }

  return {
    defaultModel: defaultModels[0] ?? entries[0]![0],
    models,
  };
}

export function readModelConfig(): ModelConfigResult {
  try {
    return {
      ok: true,
      config: parseModelConfig(process.env[GENUI_MODEL_CONFIG_ENV]),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function addSensitiveVariants(values: Set<string>, value: string): void {
  if (!value) return;
  values.add(value);
  values.add(encodeURIComponent(value));
  values.add(JSON.stringify(value).slice(1, -1));
  try {
    values.add(decodeURIComponent(value));
  } catch {
    // Keep the original variants when the value is not URL encoded.
  }
}

export function redactModelConfigSecrets(message: string): string {
  const result = readModelConfig();
  if (!result.ok) return message;

  const sensitiveValues = new Set<string>();
  for (const config of Object.values(result.config.models)) {
    addSensitiveVariants(sensitiveValues, config.apiKey);
    addSensitiveVariants(sensitiveValues, config.baseURL);
    addSensitiveVariants(sensitiveValues, config.model);
    try {
      const url = new URL(config.baseURL);
      addSensitiveVariants(sensitiveValues, url.origin);
      addSensitiveVariants(sensitiveValues, url.host);
      addSensitiveVariants(sensitiveValues, url.hostname);
      addSensitiveVariants(sensitiveValues, url.username);
      addSensitiveVariants(sensitiveValues, url.password);
      for (const value of url.searchParams.values()) {
        addSensitiveVariants(sensitiveValues, value);
      }
    } catch {
      // parseConfiguredModel already validates this URL.
    }
  }

  return [...sensitiveValues]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (redacted, sensitive) => redacted.replaceAll(sensitive, '[REDACTED]'),
      message,
    )
    .replace(/\bBearer\s+[^\s,;"']+/giu, 'Bearer [REDACTED]')
    .replace(
      /([?&](?:access_token|api[_-]?key|key|token)=)[^&#\s"'<>]*/giu,
      '$1[REDACTED]',
    );
}

export function getModelConfig(): GenUIModelConfig {
  const result = readModelConfig();
  if (!result.ok) throw new Error(result.error);
  return result.config;
}

export function resolveModelConfig(
  name?: string,
): ResolvedModelConfig {
  const config = getModelConfig();
  const resolvedName = name && config.models[name] ? name : config.defaultModel;
  return { name: resolvedName, config: config.models[resolvedName]! };
}

export function configuredModelName(
  name: string | undefined,
): string | undefined {
  if (!name) return undefined;
  const result = readModelConfig();
  return result.ok && result.config.models[name] ? name : undefined;
}

export function defaultModelName(): string | undefined {
  const result = readModelConfig();
  return result.ok ? result.config.defaultModel : undefined;
}

export function configuredApiStyle(
  name?: string,
): 'chat' | 'responses' | undefined {
  const result = readModelConfig();
  if (!result.ok) return undefined;
  const resolvedName = name && result.config.models[name]
    ? name
    : result.config.defaultModel;
  return result.config.models[resolvedName]!.api;
}
