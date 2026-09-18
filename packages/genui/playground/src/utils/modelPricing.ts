// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readTokenUsage } from './tokenUsage.js';
import type { TokenUsage } from './tokenUsage.js';

/** Configured CNY prices per thousand tokens. */
export interface ModelPrices {
  input_price: number;
  cached_price: number;
  output_price: number;
}

export interface GenerationUsageRecord {
  model: string;
  modelPrices?: ModelPrices;
  usage: TokenUsage;
  generationAttempts?: GenerationAttemptUsage[];
}

export interface GenerationAttemptUsage {
  mode?: 'initial' | 'continue' | 'regenerate';
  outputChars?: number;
  finishReason?: string;
  usage: TokenUsage;
}

export function readModelPrices(value: unknown): ModelPrices | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const keys = ['input_price', 'cached_price', 'output_price'] as const;
  if (
    !keys.every(key =>
      typeof source[key] === 'number' && Number.isFinite(source[key])
      && source[key] >= 0
    )
  ) return undefined;
  return {
    input_price: source.input_price as number,
    cached_price: source.cached_price as number,
    output_price: source.output_price as number,
  };
}

export function estimateTokenCost(
  usage: TokenUsage,
  prices: ModelPrices | undefined,
): number | undefined {
  const rates = readModelPrices(prices);
  const { inputTokens, cachedTokens, outputTokens } = usage;
  if (
    !rates || inputTokens === undefined || cachedTokens === undefined
    || outputTokens === undefined
    || ![inputTokens, cachedTokens, outputTokens].every(value =>
      Number.isFinite(value) && value >= 0
    ) || cachedTokens > inputTokens
  ) return undefined;
  const cost = ((inputTokens - cachedTokens) * rates.input_price
    + cachedTokens * rates.cached_price
    + outputTokens * rates.output_price) / 1_000;
  return Number.isFinite(cost) ? cost : undefined;
}

export function sumEstimatedCosts(
  costs: (number | undefined)[],
): number | undefined {
  if (costs.length === 0 || costs.some(cost => cost === undefined)) {
    return undefined;
  }
  const total = costs.reduce<number>((sum, cost) => sum + cost!, 0);
  return Number.isFinite(total) ? total : undefined;
}

export function formatEstimatedCost(cost: number | undefined): string {
  if (cost === undefined || !Number.isFinite(cost)) return 'Not available';
  if (cost > 0 && cost < 0.0001) return '< ¥0.0001';
  return `¥${cost.toFixed(4)}`;
}

/** Prefer the canonical breakdown, including explicit unknown (null) fields. */
export function readResponseUsage(payload: unknown): TokenUsage | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as Record<string, unknown>;
  if ('tokenUsage' in data) return readTokenUsage(data.tokenUsage);
  if ('usage' in data) return readTokenUsage(data.usage);
  return undefined;
}

/** Keep only the public attempt breakdown, not arbitrary provider metadata. */
export function readGenerationAttempts(
  payload: unknown,
): GenerationAttemptUsage[] | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const { metadata } = payload as Record<string, unknown>;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const { generationAttempts } = metadata as Record<string, unknown>;
  if (
    !Array.isArray(generationAttempts) || generationAttempts.length === 0
    || !generationAttempts.every(attempt =>
      attempt !== null && typeof attempt === 'object' && !Array.isArray(attempt)
    )
  ) return undefined;
  return generationAttempts.map((attempt: Record<string, unknown>) => ({
    mode: attempt.mode === 'initial' || attempt.mode === 'continue'
        || attempt.mode === 'regenerate'
      ? attempt.mode
      : undefined,
    outputChars: typeof attempt.outputChars === 'number'
        && Number.isSafeInteger(attempt.outputChars) && attempt.outputChars >= 0
      ? attempt.outputChars
      : undefined,
    finishReason: typeof attempt.finishReason === 'string'
      ? attempt.finishReason.slice(0, 80)
      : undefined,
    usage: readResponseUsage(attempt) ?? {},
  }));
}
