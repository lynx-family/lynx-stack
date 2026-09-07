// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { describe, expect, test } from '@rstest/core';

import app from '../src/app.js';

const ARTIFACT = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"><title>Card</title></head>',
  '<body><main>Card</main></body>',
  '</html>',
].join('\n');

interface MockHtmlService {
  streamAsAsyncIterable: () => Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string;
      usage: unknown;
      finishReason: string;
    }>;
  }>;
}

type GlobalWithHtmlService = typeof globalThis & {
  __HTML_AGENT_SERVICE__?: MockHtmlService;
};

describe('HTML stream route', () => {
  test('streams deltas and normalizes the final document', async () => {
    const global = globalThis as GlobalWithHtmlService;
    const previous = global.__HTML_AGENT_SERVICE__;
    global.__HTML_AGENT_SERVICE__ = {
      streamAsAsyncIterable() {
        return Promise.resolve({
          textStream: Readable.from(['```html\n', ARTIFACT]),
          finalize: () =>
            Promise.resolve({
              text: `Generated document:\n${ARTIFACT}\n\`\`\``,
              usage: { inputTokens: 4, outputTokens: 8 },
              finishReason: 'stop',
            }),
        });
      },
    };

    try {
      const response = await app.request('/html/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.48',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a card' }],
        }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      );
      const body = await response.text();
      expect(body).toContain('event: delta\ndata: {"text":"```html\\n"}');
      expect(body).toContain(`"text":${JSON.stringify(ARTIFACT)}`);
      expect(body).toContain('event: done');
      expect(body).toContain(
        '"usage":{"inputTokens":4,"outputTokens":8}',
      );
      expect(body).not.toContain('Generated document:');
    } finally {
      global.__HTML_AGENT_SERVICE__ = previous;
    }
  });

  test('redacts a request-scoped API key from stream errors', async () => {
    const global = globalThis as GlobalWithHtmlService;
    const previous = global.__HTML_AGENT_SERVICE__;
    const apiKey = 'request-only-secret+/=';
    const encodedKey = encodeURIComponent(apiKey);
    global.__HTML_AGENT_SERVICE__ = {
      streamAsAsyncIterable() {
        return Promise.reject(
          new Error(`upstream exposed ${apiKey} and ${encodedKey}`),
        );
      },
    };

    try {
      const response = await app.request('/html/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.49',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a card' }],
          model: 'gpt-custom',
          apiKey,
          baseURL: 'https://api.openai.com/v1',
        }),
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('event: error');
      expect(body).toContain('[REDACTED]');
      expect(body).not.toContain(apiKey);
      expect(body).not.toContain(encodedKey);
    } finally {
      global.__HTML_AGENT_SERVICE__ = previous;
    }
  });
});
