// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { extractTokenUsage, extractUsageMetrics } from '../app/common/usage.js';

describe('prompt cache usage metrics', () => {
  test.each([
    {
      inputTokens: 2048,
      outputTokens: 128,
      totalTokens: 2176,
      cachedInputTokens: 1024,
    },
    {
      input_tokens: 2048,
      output_tokens: 128,
      total_tokens: 2176,
      input_tokens_details: { cached_tokens: 1024 },
    },
    {
      prompt_tokens: 2048,
      completion_tokens: 128,
      total_tokens: 2176,
      prompt_tokens_details: { cached_tokens: 1024 },
    },
    {
      inputTokens: { total: 2048, cacheRead: 1024 },
      outputTokens: { total: 128 },
      totalTokens: 2176,
    },
    {
      inputTokens: 2048,
      outputTokens: 128,
      totalTokens: 2176,
      inputTokenDetails: { cacheReadTokens: 1024 },
    },
  ])(
    'preserves cached token counts across SDK/provider formats: %j',
    (usage) => {
      expect(extractUsageMetrics(usage)).toEqual({
        inputTokens: 2048,
        outputTokens: 128,
        totalTokens: 2176,
        cachedTokens: 1024,
        cachedTokenRatio: 0.5,
      });
    },
  );

  test('distinguishes a cold cache from an unreported cache count', () => {
    expect(
      extractUsageMetrics({ inputTokens: 2048, cachedInputTokens: 0 })
        .cachedTokenRatio,
    ).toBe(0);
    expect(extractUsageMetrics({ inputTokens: 2048 }).cachedTokens)
      .toBeUndefined();
  });
});

describe('generation token usage for pricing', () => {
  test.each([
    {
      input_tokens: 100,
      output_tokens: 20,
      input_tokens_details: { cached_tokens: 60 },
    },
    {
      prompt_tokens: 100,
      completion_tokens: 20,
      prompt_tokens_details: { cached_tokens: 60 },
    },
    { inputTokens: { total: 100, cacheRead: 60 }, outputTokens: { total: 20 } },
    {
      inputTokens: 100,
      outputTokens: 20,
      inputTokenDetails: { cacheReadTokens: 60 },
    },
  ])(
    'normalizes every price dimension without counting cached input twice: %j',
    usage => {
      const tokens = extractTokenUsage(usage);
      expect(tokens).toEqual({
        inputTokens: 100,
        cachedTokens: 60,
        outputTokens: 20,
        totalTokens: 120,
      });
      const model = { input_price: 2, cached_price: 0.5, output_price: 8 };
      expect(
        ((tokens.inputTokens! - tokens.cachedTokens!) * model.input_price
          + tokens.cachedTokens! * model.cached_price
          + tokens.outputTokens! * model.output_price) / 1_000,
      )
        .toBe(0.27);
    },
  );

  test('keeps missing or invalid dimensions unknown and preserves explicit zeros', () => {
    expect(extractTokenUsage(undefined)).toEqual({
      inputTokens: null,
      cachedTokens: null,
      outputTokens: null,
    });
    expect(
      extractTokenUsage({
        inputTokens: -1,
        cachedTokens: '10',
        outputTokens: Number.POSITIVE_INFINITY,
      }),
    )
      .toEqual({ inputTokens: null, cachedTokens: null, outputTokens: null });
    expect(
      extractTokenUsage({ inputTokens: 0, cachedTokens: 0, outputTokens: 0 }),
    )
      .toEqual({
        inputTokens: 0,
        cachedTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
  });

  test('preserves cache-write and reasoning details through accumulated attempts', () => {
    const usage = {
      inputTokens: { total: 100, cacheRead: 60, cacheWrite: 10 },
      outputTokens: { total: 20, reasoning: 8 },
    };
    expect(extractTokenUsage([usage, usage])).toEqual({
      inputTokens: 200,
      cachedTokens: 120,
      outputTokens: 40,
      totalTokens: 240,
      cacheWriteTokens: 20,
      reasoningTokens: 16,
    });
    expect(extractTokenUsage([usage, { inputTokens: 10, outputTokens: 5 }]))
      .toEqual({
        inputTokens: 110,
        cachedTokens: null,
        outputTokens: 25,
        totalTokens: 135,
      });
  });
});
