// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNumberProperty(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const candidate = value[key];
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function findCachedTokens(value: unknown): number | undefined {
  if (!isRecord(value)) return undefined;

  const direct = readNumberProperty(value, 'cached_tokens')
    ?? readNumberProperty(value, 'cachedTokens')
    ?? readNumberProperty(value, 'cached_input_tokens')
    ?? readNumberProperty(value, 'cachedInputTokens')
    ?? readNumberProperty(value, 'cache_read_input_tokens');
  if (direct !== undefined) return direct;

  for (const nested of Object.values(value)) {
    const found = findCachedTokens(nested);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function extractCachedTokens(usage: unknown): number | undefined {
  return findCachedTokens(usage);
}

export interface UsageMetrics {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  cachedTokens?: number | undefined;
  cachedTokenRatio?: number | undefined;
}

export function extractUsageMetrics(usage: unknown): UsageMetrics {
  if (!isRecord(usage)) return {};

  const inputTokens = readNumberProperty(usage, 'inputTokens')
    ?? readNumberProperty(usage, 'input_tokens')
    ?? readNumberProperty(usage, 'promptTokens')
    ?? readNumberProperty(usage, 'prompt_tokens');
  const outputTokens = readNumberProperty(usage, 'outputTokens')
    ?? readNumberProperty(usage, 'output_tokens')
    ?? readNumberProperty(usage, 'completionTokens')
    ?? readNumberProperty(usage, 'completion_tokens');
  const totalTokens = readNumberProperty(usage, 'totalTokens')
    ?? readNumberProperty(usage, 'total_tokens');
  const cachedTokens = extractCachedTokens(usage);
  const cachedTokenRatio = inputTokens && cachedTokens !== undefined
    ? cachedTokens / inputTokens
    : undefined;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedTokens,
    cachedTokenRatio,
  };
}
