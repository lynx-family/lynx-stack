// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { readGenerationMetrics } from './generationMetrics.js';

test('reads finite non-negative generation metrics independently', () => {
  expect(readGenerationMetrics({
    metrics: {
      generationMs: 800,
      firstReasoningTokenMs: 120,
      firstTextTokenMs: 260,
      modelMs: 700,
      searchMs: 180,
      imageGenerationMs: 420,
    },
  })).toEqual({
    generationMs: 800,
    firstReasoningTokenMs: 120,
    firstTextTokenMs: 260,
    modelMs: 700,
    searchMs: 180,
    imageGenerationMs: 420,
  });

  expect(readGenerationMetrics({
    metrics: {
      generationMs: -1,
      firstTextTokenMs: 25,
      modelMs: Number.NaN,
      searchMs: -2,
      imageGenerationMs: 40,
    },
  })).toEqual({ firstTextTokenMs: 25, imageGenerationMs: 40 });
});

test('rejects payloads without valid generation metrics', () => {
  expect(readGenerationMetrics(undefined)).toBeUndefined();
  expect(readGenerationMetrics({ metrics: null })).toBeUndefined();
  expect(readGenerationMetrics({
    metrics: { generationMs: Number.POSITIVE_INFINITY },
  })).toBeUndefined();
});
