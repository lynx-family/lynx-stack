// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  CUSTOM_PROVIDER_BASE_URL,
  CUSTOM_PROVIDER_ID,
  CUSTOM_PROVIDER_MODEL,
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
