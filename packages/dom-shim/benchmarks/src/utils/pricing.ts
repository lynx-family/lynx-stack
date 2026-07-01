// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Public list prices (USD per 1M tokens) as of 2026-06.
 *
 * Sources (consulted 2026-06):
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing
 *
 * If a model is not in this table, cost computation returns 0 and the
 * report surfaces a `pricing_missing: true` note. Update this file (not
 * any route) when prices move.
 */
export interface ModelPrice {
  /** USD per 1,000,000 input tokens. */
  input_per_1m: number;
  /** USD per 1,000,000 output tokens. */
  output_per_1m: number;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  'gpt-4o': { input_per_1m: 2.5, output_per_1m: 10 },
  'gpt-4o-mini': { input_per_1m: 0.15, output_per_1m: 0.6 },
  'claude-opus-4-7': { input_per_1m: 15, output_per_1m: 75 },
  'claude-sonnet-4-6': { input_per_1m: 3, output_per_1m: 15 },
};

/**
 * Compute USD cost for an (input_tokens, output_tokens) pair under a model's
 * list price. Returns 0 if the model is unknown — callers should also set the
 * `pricing_missing` flag in that case.
 */
export function estimateUsdCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICING[modelId];
  if (!price) return 0;
  return (
    (inputTokens * price.input_per_1m) / 1_000_000
    + (outputTokens * price.output_per_1m) / 1_000_000
  );
}

export function hasPricing(modelId: string): boolean {
  return modelId in MODEL_PRICING;
}
