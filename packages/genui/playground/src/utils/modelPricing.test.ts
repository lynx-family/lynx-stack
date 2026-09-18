// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import {
  estimateTokenCost,
  formatEstimatedCost,
  readModelPrices,
  readResponseUsage,
  sumEstimatedCosts,
} from './modelPricing.js';

const prices = { input_price: 2, cached_price: 0.5, output_price: 8 };

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

test('prefers canonical unknown counts and retains missing data across repair attempts', () => {
  const usage = readResponseUsage({
    tokenUsage: { inputTokens: 10, cachedTokens: null, outputTokens: 5 },
    usage: { inputTokens: 10, cachedTokens: 0, outputTokens: 5 },
  })!;
  expect(estimateTokenCost(usage, prices)).toBeUndefined();
  const attempts = readResponseUsage({
    usage: [
      { inputTokens: 10, cachedTokens: 0, outputTokens: 5 },
      { inputTokens: 10, outputTokens: 5 },
    ],
  })!;
  expect(attempts).toMatchObject({ inputTokens: 20, outputTokens: 10 });
  expect(estimateTokenCost(attempts, prices)).toBeUndefined();
  expect(sumEstimatedCosts([0.1, undefined])).toBeUndefined();
});

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
