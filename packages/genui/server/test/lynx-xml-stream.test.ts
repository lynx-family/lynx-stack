// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { describe, expect, test } from '@rstest/core';

import app from '../src/app.js';

const ARTIFACT = [
  '<!doctype lynx>',
  '<lynx engine-version="4.2">',
  '<script thread="main">globalThis.processData = () => {};</script>',
  '</lynx>',
].join('\n');

interface MockLynxXmlService {
  streamAsAsyncIterable: () => Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string;
      usage: unknown;
      finishReason: string;
    }>;
  }>;
}

type GlobalWithLynxXmlService = typeof globalThis & {
  __LYNX_XML_AGENT_SERVICE__?: MockLynxXmlService;
};

describe('Lynx XML stream route', () => {
  test('streams deltas and normalizes the final artifact', async () => {
    const global = globalThis as GlobalWithLynxXmlService;
    const previous = global.__LYNX_XML_AGENT_SERVICE__;
    global.__LYNX_XML_AGENT_SERVICE__ = {
      streamAsAsyncIterable() {
        return Promise.resolve({
          textStream: Readable.from(['```xml\n', ARTIFACT]),
          finalize: () =>
            Promise.resolve({
              text: `Generated artifact:\n${ARTIFACT}\n\`\`\``,
              usage: { inputTokens: 3, outputTokens: 5 },
              finishReason: 'stop',
            }),
        });
      },
    };

    try {
      const response = await app.request('/lynx-xml/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.47',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a counter' }],
        }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      );
      const body = await response.text();
      expect(body).toContain('event: delta\ndata: {"text":"```xml\\n"}');
      expect(body).toContain(`"text":${JSON.stringify(ARTIFACT)}`);
      expect(body).toContain('event: done');
      expect(body).toContain(
        '"usage":{"inputTokens":3,"outputTokens":5}',
      );
      expect(body).not.toContain('Generated artifact:');
    } finally {
      global.__LYNX_XML_AGENT_SERVICE__ = previous;
    }
  });

  test('reports token-limit metadata when the final artifact is incomplete', async () => {
    const global = globalThis as GlobalWithLynxXmlService;
    const previous = global.__LYNX_XML_AGENT_SERVICE__;
    const incompleteArtifact = ARTIFACT.slice(0, -'</lynx>'.length);
    global.__LYNX_XML_AGENT_SERVICE__ = {
      streamAsAsyncIterable() {
        return Promise.resolve({
          textStream: Readable.from([incompleteArtifact]),
          finalize: () =>
            Promise.resolve({
              text: incompleteArtifact,
              usage: { inputTokens: 100, outputTokens: 4096 },
              finishReason: 'length',
            }),
        });
      },
    };

    try {
      const response = await app.request('/lynx-xml/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.48',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a dashboard' }],
        }),
      });
      const body = await response.text();
      expect(body).toContain('event: delta');
      expect(body).toContain('event: error');
      expect(body).toContain(
        'Model output reached its token limit before producing a valid final artifact',
      );
      expect(body).toContain('"finishReason":"length"');
      expect(body).toContain(
        '"usage":{"inputTokens":100,"outputTokens":4096}',
      );
      expect(body).not.toContain('event: done');
    } finally {
      global.__LYNX_XML_AGENT_SERVICE__ = previous;
    }
  });
});
