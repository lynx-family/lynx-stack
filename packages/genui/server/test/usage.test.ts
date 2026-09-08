// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { extractUsageMetrics } from '../app/common/usage.js';

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
