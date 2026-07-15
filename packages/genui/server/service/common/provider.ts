// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';

import type { ChatOptions, OpenAIReasoningEffort } from './types';

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

export function resolveReasoningEffort(
  opts: ChatOptions,
): OpenAIReasoningEffort | undefined {
  return parseReasoningEffort(opts.reasoningEffort)
    ?? parseReasoningEffort(process.env.OPENAI_REASONING_EFFORT);
}

export function buildResourceRunOptions(
  opts: ChatOptions,
  abortSignal?: AbortSignal,
) {
  return pickDefined({ resourceId: opts.resourceId, abortSignal });
}

export function buildOpenAIRunOptions(opts: ChatOptions) {
  const reasoningEffort = resolveReasoningEffort(opts);
  return pickDefined({
    resourceId: opts.resourceId,
    providerOptions: reasoningEffort
      ? { openai: { reasoningEffort } }
      : undefined,
  });
}
