// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import {
  estimateTokenCost,
  formatEstimatedCost,
  readGenerationAttempts,
  readModelPrices,
  readResponseUsage,
  sumEstimatedCosts,
} from './modelPricing.js';

const prices = { input_price: 2, cached_price: 0.5, output_price: 8 };

test('normalizes per-attempt usage without retaining arbitrary provider metadata', () => {
  const attempts = readGenerationAttempts({
    metadata: {
      generationAttempts: [
        {
          mode: 'initial',
          outputChars: 0,
          finishReason: 'length',
          usage: {
            prompt_tokens: 100,
            completion_tokens: 16000,
            completion_tokens_details: { reasoning_tokens: 16000 },
          },
          error: { upstreamRequestId: 'private-id' },
        },
        {
          mode: 'regenerate',
          outputChars: 3200,
          finishReason: 'stop',
          tokenUsage: { outputTokens: 1300, reasoningTokens: 0 },
          usage: { outputTokens: 9999, reasoningTokens: 9999 },
          providerMetadata: { secret: 'private-value' },
        },
      ],
    },
  });
  expect(attempts).toEqual([
    {
      mode: 'initial',
      outputChars: 0,
      finishReason: 'length',
      usage: {
        inputTokens: 100,
        outputTokens: 16000,
        totalTokens: 16100,
        reasoningTokens: 16000,
      },
    },
    {
      mode: 'regenerate',
      outputChars: 3200,
      finishReason: 'stop',
      usage: { outputTokens: 1300, reasoningTokens: 0 },
    },
  ]);
});

test('keeps missing or invalid attempt details unknown without inventing a count', () => {
  for (const generationAttempts of [undefined, null, {}, [], [null], [[]]]) {
    expect(readGenerationAttempts({ metadata: { generationAttempts } }))
      .toBeUndefined();
  }
  expect(readGenerationAttempts({ tokenUsage: { outputTokens: 1300 } }))
    .toBeUndefined();
  expect(readGenerationAttempts({
    metadata: {
      generationAttempts: [{
        mode: 'other',
        outputChars: -1,
        finishReason: {},
        tokenUsage: { reasoningTokens: null },
        usage: { reasoningTokens: 0 },
      }],
    },
  })).toEqual([{
    mode: undefined,
    outputChars: undefined,
    finishReason: undefined,
    usage: {},
  }]);
});

test('uses CNY prices per thousand tokens without double-counting cache writes or reasoning', () => {
  const usage = readResponseUsage({
    tokenUsage: {
      inputTokens: 10000,
      cachedTokens: 6000,
      cacheWriteTokens: 2000,
      outputTokens: 2000,
      reasoningTokens: 1500,
    },
  })!;
  expect(estimateTokenCost(usage, prices)).toBeCloseTo(27);
  expect(formatEstimatedCost(estimateTokenCost(usage, prices))).toBe(
    '¥27.0000',
  );
});

test('prices missing cache usage without changing canonical counts or repair usage', () => {
  const usage = readResponseUsage({
    tokenUsage: { inputTokens: 10, cachedTokens: null, outputTokens: 5 },
    usage: { inputTokens: 10, cachedTokens: 0, outputTokens: 5 },
  })!;
  expect(usage.cachedTokens).toBeUndefined();
  expect(estimateTokenCost(usage, prices)).toBeCloseTo(0.06);
  const attempts = readResponseUsage({
    usage: [
      { inputTokens: 10, cachedTokens: 0, outputTokens: 5 },
      { inputTokens: 10, outputTokens: 5 },
    ],
  })!;
  expect(attempts).toMatchObject({ inputTokens: 20, outputTokens: 10 });
  expect(attempts.cachedTokens).toBeUndefined();
  expect(estimateTokenCost(attempts, prices)).toBeCloseTo(0.12);
  expect(sumEstimatedCosts([0.1, undefined])).toBeUndefined();
});

test('prices aggregated Jev calls with no cache breakdown and free output', () => {
  const usage = readResponseUsage({
    usage: [
      { inputTokens: 20000, outputTokens: 8000 },
      { inputTokens: 5482, outputTokens: 2579 },
    ],
  })!;
  // Illustrative configured CNY rate per 1K tokens, not a provider price lookup.
  const jevPrices = { input_price: 0.0003, cached_price: 0, output_price: 0 };
  expect(estimateTokenCost(usage, jevPrices)).toBeCloseTo(0.0076446, 7);
  expect(formatEstimatedCost(estimateTokenCost(usage, jevPrices))).toBe(
    '¥0.0076',
  );
  expect(usage.cachedTokens).toBeUndefined();
});

test('still requires input, output and configured prices', () => {
  for (const usage of [{}, { inputTokens: 10 }, { outputTokens: 5 }]) {
    expect(estimateTokenCost(usage, prices)).toBeUndefined();
  }
  expect(estimateTokenCost({ inputTokens: 10, outputTokens: 5 }, undefined))
    .toBeUndefined();
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 11])(
  'rejects explicitly invalid cache usage %s',
  cachedTokens => {
    expect(
      estimateTokenCost(
        { inputTokens: 10, outputTokens: 5, cachedTokens },
        prices,
      ),
    )
      .toBeUndefined();
  },
);

test('distinguishes zero, small, and unavailable costs without inventing prices', () => {
  expect(
    estimateTokenCost(
      { inputTokens: 0, cachedTokens: 0, outputTokens: 0 },
      prices,
    ),
  ).toBe(0);
  expect(
    estimateTokenCost(
      { inputTokens: 10, cachedTokens: 11, outputTokens: 5 },
      prices,
    ),
  ).toBeUndefined();
  expect(readModelPrices({ ...prices, output_price: -1 })).toBeUndefined();
  expect(readModelPrices({ input_price: 0 })).toBeUndefined();
  expect(readModelPrices({ input_price: 0, cached_price: 0, output_price: 0 }))
    .toEqual({ input_price: 0, cached_price: 0, output_price: 0 });
  expect(formatEstimatedCost(undefined)).toBe('Not available');
  expect(formatEstimatedCost(0)).toBe('¥0.0000');
  expect(formatEstimatedCost(0.000001)).toBe('< ¥0.0001');
});
