// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BenchTokens } from './BenchTokens.js';
import { readBenchTokenUsage, sumBenchTokenUsage } from './benchTokenUsage.js';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('Bench token usage', () => {
  test('reads numeric SDK usage and provider cache/reasoning details without double counting', () => {
    expect(
      readBenchTokenUsage({
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_tokens_details: { cached_tokens: 70 },
        completion_tokens_details: { reasoning_tokens: 8 },
        cache_creation_input_tokens: 10,
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedTokens: 70,
      cacheWriteTokens: 10,
      reasoningTokens: 8,
    });
    expect(
      readBenchTokenUsage({
        inputTokens: 100,
        outputTokens: 20,
        inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 10 },
        outputTokenDetails: { reasoningTokens: 8 },
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedTokens: 0,
      cacheWriteTokens: 10,
      reasoningTokens: 8,
    });
  });
  test('accumulates nested SDK usage across repair attempts', () => {
    const usage = {
      inputTokens: { total: 100, cacheRead: 60, cacheWrite: 10 },
      outputTokens: { total: 20, reasoning: 8 },
    };
    expect(readBenchTokenUsage([usage, usage])).toEqual({
      inputTokens: 200,
      outputTokens: 40,
      totalTokens: 240,
      cachedTokens: 120,
      cacheWriteTokens: 20,
      reasoningTokens: 16,
    });
  });
  test('does not turn missing or partial usage into zero cache misses', () => {
    expect(readBenchTokenUsage({ totalTokens: 42 })).toEqual({
      totalTokens: 42,
    });
    expect(
      readBenchTokenUsage([{
        inputTokens: 10,
        outputTokens: 5,
        cachedTokens: 0,
      }, { inputTokens: 10, outputTokens: 5 }]),
    ).toEqual({ inputTokens: 20, outputTokens: 10, totalTokens: 30 });
    expect(
      readBenchTokenUsage([undefined, { inputTokens: 10, outputTokens: 5 }]),
    ).toEqual({});
    expect(
      readBenchTokenUsage({
        inputTokens: -1,
        outputTokens: Number.NaN,
        cachedTokens: '10',
      }),
    ).toEqual({});
    expect(readBenchTokenUsage([])).toEqual({});
  });
});

test('keeps planned-run averaging and labels the generation-only breakdown', () => {
  const usage = sumBenchTokenUsage([{
    inputTokens: 100,
    outputTokens: 20,
    cachedTokens: 50,
  }], 2);
  expect(usage).toEqual({
    inputTokens: 50,
    outputTokens: 10,
    cachedTokens: 25,
  });
  const markup = renderToStaticMarkup(
    React.createElement(BenchTokens, { tokens: 60, usage, average: true }),
  );
  expect(markup).toContain('Average tokens per planned run');
  expect(markup).toContain('Input: 50');
  expect(markup).toContain('Cache hit rate: 50%');
  expect(markup).toContain('Cache write: Not recorded');
  expect(markup).toContain('Excludes UI Judge');
  expect(markup).toContain('<summary');
});
