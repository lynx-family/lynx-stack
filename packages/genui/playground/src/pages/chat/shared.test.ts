// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { getChatEndpoint, parseTokenUsage } from './shared.js';

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
    });
  });

  test('uses the configured localhost server by default', () => {
    expect(getChatEndpoint('a2ui', {
      baseUrl: 'https://playground.example.com/',
      hostname: 'playground.example.com',
      origin: 'https://playground.example.com',
      protocol: 'https:',
      search: '',
    })).toBe('http://localhost:3060/a2ui/stream');
  });

  test('preserves a trusted query endpoint override', () => {
    expect(getChatEndpoint('openui', {
      baseUrl: 'http://localhost:3000/',
      hostname: 'localhost',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      search: '?openuiEndpoint=http%3A%2F%2F127.0.0.1%3A3060%2Fopenui%2Fstream',
    })).toBe('http://127.0.0.1:3060/openui/stream');
  });
});
