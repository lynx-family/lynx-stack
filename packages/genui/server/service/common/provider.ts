// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';

import { readModelConfig } from './model-config.js';
import type { ChatOptions, OpenAIReasoningEffort } from './types.js';
import { isOfficialOpenAIBaseURL } from '../../agent/common/openai-utils.js';

const REASONING_EFFORTS = new Set<OpenAIReasoningEffort>([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]);

export function pickDefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function pickProviderConfig(opts: ChatOptions) {
  return pickDefined({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    model: opts.model,
    api: opts.api,
  });
}

function hashApiKey(apiKey: string | undefined): string {
  if (!apiKey) return 'default';
  return createHash('sha256').update(apiKey).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

export function createStableValueHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function createProviderCacheKey(
  opts: ChatOptions,
  variant?: string,
): string {
  const baseKey = [
    opts.baseURL ?? 'default',
    opts.model ?? 'default',
    hashApiKey(opts.apiKey),
    opts.api ?? 'default',
    opts.enableWebSearch === false ? 'search-disabled' : 'search-enabled',
    opts.enableImageGeneration === false
      ? 'image-generation-disabled'
      : 'image-generation-enabled',
    opts.enableDesignGuidance === false
      ? 'design-guidance-disabled'
      : 'design-guidance-enabled',
  ].join(':');
  return variant === undefined ? baseKey : `${baseKey}:${variant}`;
}

export const DEFAULT_PROVIDER_AGENT_CACHE_MAX_ENTRIES = 32;

export class ProviderAgentCache<TAgent> {
  private readonly cache = new Map<string, Promise<TAgent>>();

  public constructor(
    private readonly maxEntries = DEFAULT_PROVIDER_AGENT_CACHE_MAX_ENTRIES,
  ) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('maxEntries must be a positive safe integer');
    }
  }

  public get(
    opts: ChatOptions,
    create: () => TAgent | Promise<TAgent>,
    variant?: string,
  ): Promise<TAgent> {
    const startedAt = performance.now();
    const cacheKey = createProviderCacheKey(opts, variant);
    let cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      opts.onPerformanceEvent?.('agent.cache.hit', {
        durationMs: performance.now() - startedAt,
        cacheSize: this.cache.size,
      });
      return cached;
    }

    cached = Promise.resolve().then(create);
    this.cache.set(cacheKey, cached);
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
    const pending = cached;
    void pending.catch(() => {
      if (this.cache.get(cacheKey) === pending) {
        this.cache.delete(cacheKey);
      }
    });
    opts.onPerformanceEvent?.('agent.cache.miss', {
      durationMs: performance.now() - startedAt,
      cacheSize: this.cache.size,
    });
    return cached;
  }
}

function parseReasoningEffort(
  value: string | undefined,
): OpenAIReasoningEffort | undefined {
  return REASONING_EFFORTS.has(value as OpenAIReasoningEffort)
    ? value as OpenAIReasoningEffort
    : undefined;
}

function hasCustomProvider(opts: ChatOptions): boolean {
  return [opts.model, opts.apiKey, opts.baseURL].every(value =>
    typeof value === 'string' && value.trim().length > 0
  );
}

function configuredRunModel(opts: ChatOptions) {
  if (hasCustomProvider(opts)) return undefined;
  const config = readModelConfig();
  if (!config.ok) return undefined;
  const modelName = opts.model && config.config.models[opts.model]
    ? opts.model
    : config.config.defaultModel;
  return config.config.models[modelName];
}

export function resolveReasoningEffort(
  opts: ChatOptions,
): OpenAIReasoningEffort | undefined {
  const explicit = parseReasoningEffort(opts.reasoningEffort);
  if (explicit !== undefined) return explicit;
  if (opts.inheritReasoningEffort === false) return undefined;
  return configuredRunModel(opts)?.reasoningEffort;
}

/** Shared per-call generation target, further bounded by the selected model. */
export const DEFAULT_AGENT_MAX_OUTPUT_TOKENS = 16_384;

export function resolveModelOutputTokenBudget(
  opts: ChatOptions,
  desiredMaxOutputTokens = DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
): number {
  if (
    !Number.isSafeInteger(desiredMaxOutputTokens) || desiredMaxOutputTokens <= 0
  ) {
    throw new RangeError('maxOutputTokens must be a positive safe integer');
  }
  const configuredLimit = configuredRunModel(opts)?.maxOutputTokens;
  return configuredLimit === undefined
    ? desiredMaxOutputTokens
    : Math.min(desiredMaxOutputTokens, configuredLimit);
}

export interface ReasoningRecoverySettings {
  maxOutputTokens: number;
  reasoningEffort: OpenAIReasoningEffort;
}

/** Adapt one fresh attempt after reasoning consumed the entire output budget. */
export function resolveReasoningRecoverySettings(
  opts: ChatOptions,
  currentMaxOutputTokens: number,
): ReasoningRecoverySettings | undefined {
  if (opts.inheritReasoningEffort === false) return undefined;
  const currentEffort = resolveReasoningEffort(opts);
  const reasoningEffort = currentEffort === 'none'
      || currentEffort === 'minimal' || currentEffort === 'low'
    ? currentEffort
    : 'low';
  const ceiling = configuredRunModel(opts)?.maxOutputTokens;
  // Never assume a provider without a configured ceiling supports more tokens.
  const maxOutputTokens = ceiling === undefined
    ? currentMaxOutputTokens
    : Math.min(currentMaxOutputTokens * 2, ceiling);
  return reasoningEffort === currentEffort
      && maxOutputTokens <= currentMaxOutputTokens
    ? undefined
    : { maxOutputTokens, reasoningEffort };
}

export function buildOpenAIRunOptions(
  opts: ChatOptions,
  abortSignal?: AbortSignal,
  desiredMaxOutputTokens = DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
) {
  const reasoningEffort = resolveReasoningEffort(opts);
  const baseURL = hasCustomProvider(opts)
    ? opts.baseURL
    : configuredRunModel(opts)?.baseURL;
  const compatibleProvider = baseURL !== undefined
    && !isOfficialOpenAIBaseURL(baseURL);
  return {
    ...pickDefined({
      resourceId: opts.resourceId,
      abortSignal,
      providerOptions: reasoningEffort
        ? {
          openai: {
            reasoningEffort,
            ...(compatibleProvider
              ? {
                // Configured effort also applies to model aliases unknown to the SDK.
                forceReasoning: true,
                systemMessageMode: 'system' as const,
                reasoningSummary: null,
              }
              : {}),
          },
        }
        : undefined,
    }),
    modelSettings: {
      ...pickDefined({ maxRetries: opts.maxRetries }),
      maxOutputTokens: resolveModelOutputTokenBudget(
        opts,
        desiredMaxOutputTokens,
      ),
    },
  };
}
