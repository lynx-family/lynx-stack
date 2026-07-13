// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { parseTokenUsage } from './shared.js';

describe('shared chat helpers', () => {
  test('parses OpenAI-style input and output token keys', () => {
    expect(parseTokenUsage({
      input_tokens: 2,
      output_tokens: 3,
      total_tokens: 5,
    })).toEqual({
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
      cachedTokens: 0,
    });
  });

  test('parses cached token hits from top-level and nested keys', () => {
    expect(parseTokenUsage({
      input_tokens: 12,
      output_tokens: 4,
      input_tokens_details: { cached_tokens: 8 },
    })).toEqual({
      promptTokens: 12,
      completionTokens: 4,
      totalTokens: 16,
      cachedTokens: 8,
    });

    expect(parseTokenUsage({ total_tokens: 20 }, 9)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 20,
      cachedTokens: 9,
    });

    expect(parseTokenUsage(undefined, 6)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 6,
    });
  });
});
