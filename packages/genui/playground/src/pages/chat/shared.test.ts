// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  describeChatRequestError,
  getChatEndpoint,
  parseTokenUsage,
} from './shared.js';
import { isDevHost } from '../../utils/publishPayload.js';

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

  test('explains how to recover when the local GenUI server is unreachable', () => {
    expect(
      describeChatRequestError(
        new TypeError('Failed to fetch'),
        'http://localhost:3060/lynx-xml/stream',
      ),
    ).toBe(
      'Cannot reach the local GenUI server at http://localhost:3060. '
        + 'Start it with `OPENAI_API_KEY=... pnpm -C packages/genui/server dev`, '
        + 'then retry.',
    );
  });

  test('preserves application errors returned by the GenUI server', () => {
    expect(
      describeChatRequestError(
        new Error('Generated Lynx XML is invalid'),
        'http://localhost:3060/lynx-xml/stream',
      ),
    ).toBe('Generated Lynx XML is invalid');
  });

  test('routes IPv6 loopback Playground traffic to the local GenUI server', () => {
    expect(isDevHost('[::1]')).toBe(true);
    expect(
      getChatEndpoint('lynx-xml', {
        origin: 'http://[::1]:3000',
        hostname: '[::1]',
        protocol: 'http:',
        search: '',
        baseUrl: 'http://[::1]:3000/',
      }),
    ).toBe('http://127.0.0.1:3060/lynx-xml/stream');
  });
});
