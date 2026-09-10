// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  CUSTOM_PROVIDER_BASE_URL,
  CUSTOM_PROVIDER_ID,
  CUSTOM_PROVIDER_MODEL,
  EMPTY_CHAT_TOKEN_USAGE,
  addTokenUsage,
  assertProviderRequestTarget,
  createChatRequestInit,
  getChatEndpoint,
  parseTokenUsage,
} from './shared.js';
import type { ProviderSettings } from './shared.js';

const CUSTOM_SETTINGS: ProviderSettings = {
  provider: CUSTOM_PROVIDER_ID,
  apiKey: 'sk-test',
  baseURL: CUSTOM_PROVIDER_BASE_URL,
  model: CUSTOM_PROVIDER_MODEL,
  models: [],
  status: 'ready',
};

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

  test.each([
    { prompt_tokens_details: { cached_tokens: 1024, cache_write_tokens: 512 } },
    { input_tokens_details: { cached_tokens: 1024, cache_write_tokens: 512 } },
    { cachedInputTokens: 1024, cacheWriteTokens: 512 },
    { inputTokenDetails: { cacheReadTokens: 1024, cacheWriteTokens: 512 } },
    { cache_read_input_tokens: 1024, cache_creation_input_tokens: 512 },
  ])('reads cache usage without adding it to token totals: %j', (details) => {
    expect(parseTokenUsage({
      inputTokens: 2048,
      outputTokens: 128,
      ...details,
    })).toEqual({
      promptTokens: 2048,
      completionTokens: 128,
      totalTokens: 2176,
      cachedTokens: 1024,
      cacheWriteTokens: 512,
    });
  });

  test('parses nested AI SDK totals and cache reads and writes', () => {
    expect(parseTokenUsage({
      inputTokens: { total: 2048, cacheRead: 1024, cacheWrite: 512 },
      outputTokens: { total: 128 },
    })).toEqual({
      promptTokens: 2048,
      completionTokens: 128,
      totalTokens: 2176,
      cachedTokens: 1024,
      cacheWriteTokens: 512,
    });
  });

  test('distinguishes reported cache misses from absent or invalid usage', () => {
    const base = { inputTokens: 2048, outputTokens: 128 };
    expect(parseTokenUsage({
      ...base,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 2048 },
    })).toMatchObject({ cachedTokens: 0, cacheWriteTokens: 2048 });
    for (
      const cached_tokens of [
        undefined,
        null,
        '1024',
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
      ]
    ) {
      expect(parseTokenUsage({
        ...base,
        input_tokens_details: { cached_tokens },
      })).not.toHaveProperty('cachedTokens');
    }
  });

  test('accumulates cache counts across calls using the empty usage identity', () => {
    const first = {
      promptTokens: 2048,
      completionTokens: 128,
      totalTokens: 2176,
      cachedTokens: 1024,
      cacheWriteTokens: 512,
    };
    expect(addTokenUsage(EMPTY_CHAT_TOKEN_USAGE, first)).toEqual(first);
    expect(addTokenUsage(first, {
      promptTokens: 4096,
      completionTokens: 256,
      totalTokens: 4352,
      cachedTokens: 0,
      cacheWriteTokens: 4096,
    })).toEqual({
      promptTokens: 6144,
      completionTokens: 384,
      totalTokens: 6528,
      cachedTokens: 1024,
      cacheWriteTokens: 4608,
    });
  });

  test('keeps aggregate cache reads unknown if any call omits them', () => {
    const reported = {
      promptTokens: 2048,
      completionTokens: 128,
      totalTokens: 2176,
      cachedTokens: 1024,
      cacheWriteTokens: 0,
    };
    const missing = {
      promptTokens: 4096,
      completionTokens: 256,
      totalTokens: 4352,
      cacheWriteTokens: 4096,
    };
    const expected = {
      promptTokens: 6144,
      completionTokens: 384,
      totalTokens: 6528,
      cacheWriteTokens: 4096,
    };
    expect(addTokenUsage(reported, missing)).toEqual(expected);
    expect(addTokenUsage(missing, reported)).toEqual(expected);
    expect(addTokenUsage(expected, reported)).not.toHaveProperty(
      'cachedTokens',
    );
  });

  test('rejects redirects for credential-bearing chat requests', () => {
    const signal = new AbortController().signal;
    expect(createChatRequestInit({
      url: 'https://genui.example.com/a2ui/stream',
      body: { apiKey: 'sk-test' },
    }, signal)).toMatchObject({
      method: 'POST',
      redirect: 'error',
      body: '{"apiKey":"sk-test"}',
      signal,
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

  test('ignores query endpoint overrides for custom API keys', () => {
    expect(getChatEndpoint('openui', {
      baseUrl: 'http://localhost:3000/',
      hostname: 'localhost',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      search: '?openuiEndpoint=http%3A%2F%2F127.0.0.1%3A3060%2Fcollect',
    }, CUSTOM_SETTINGS)).toBe('http://localhost:3060/openui/stream');
  });

  test('rejects custom API key requests to a different origin', () => {
    expect(() =>
      assertProviderRequestTarget(
        CUSTOM_SETTINGS,
        'http://127.0.0.1:3060/a2ui/stream',
      )
    ).toThrow('configured GenUI Server origin');
  });

  test('builds the HTML stream endpoint', () => {
    expect(getChatEndpoint('html', {
      baseUrl: 'http://localhost:3000/',
      hostname: 'localhost',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      search: '',
    })).toBe('http://localhost:3060/html/stream');
  });
});
