// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { describe, expect, test } from '@rstest/core';

import {
  GenerationPostprocessError,
  finalizeResult,
} from '../service/common/result.js';
import type { LynxXmlChatOptions } from '../service/lynx-xml/lynx-xml-agent.js';
import app from '../src/app.js';

const ARTIFACT = [
  '<!doctype lynx>',
  '<lynx engine-version="4.2">',
  '<script thread="main">globalThis.processData = () => {};</script>',
  '</lynx>',
].join('\n');

interface MockLynxXmlService {
  streamAsAsyncIterable: (
    messages?: unknown,
    options?: LynxXmlChatOptions,
  ) => Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string;
      usage: unknown;
      finishReason: unknown;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}

type GlobalWithLynxXmlService = typeof globalThis & {
  __LYNX_XML_AGENT_SERVICE__?: MockLynxXmlService;
};

describe('Lynx XML stream route', () => {
  test.each([false, true])(
    'returns the upstream failure before XML processing (fragment=%s)',
    async enableHtmlFragment => {
      const global = globalThis as GlobalWithLynxXmlService;
      const previous = global.__LYNX_XML_AGENT_SERVICE__;
      const usage = {
        inputTokens: 9685,
        outputTokens: 16384,
        reasoningTokens: 16384,
      };
      const upstream = Object.assign(
        new Error('Invalid input: Bearer request-secret'),
        {
          statusCode: 400,
          responseHeaders: {
            'x-request-id': 'ark-request-1',
            authorization: 'private-header',
          },
          requestBodyValues: { input: 'private prompt' },
          responseBody: 'private response body',
        },
      );
      global.__LYNX_XML_AGENT_SERVICE__ = {
        streamAsAsyncIterable: () =>
          Promise.resolve({
            textStream: Readable.from([]),
            finalize: async () => ({
              ...await finalizeResult({
                text: '',
                usage,
                finishReason: 'error',
                error: upstream,
              }),
              text: '',
            }),
          }),
      };
      try {
        const response = await app.request('/lynx-xml/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            enableHtmlFragment,
          }),
        });
        const body = await response.text();
        const frame = body.split('\n\n').find(value =>
          value.startsWith('event: error\n')
        )!;
        expect(JSON.parse(frame.slice('event: error\ndata: '.length)))
          .toMatchObject({
            message: 'Invalid input: Bearer [REDACTED]',
            statusCode: 400,
            upstreamRequestId: 'ark-request-1',
            finishReason: 'error',
            usage,
          });
        expect(body).not.toContain('event: done');
        expect(body).not.toContain('doctype');
        expect(body).not.toContain('private');
        expect(body).not.toContain('request-secret');
      } finally {
        global.__LYNX_XML_AGENT_SERVICE__ = previous;
      }
    },
  );

  test('does not accept complete XML when the service reports an error without details', async () => {
    const global = globalThis as GlobalWithLynxXmlService;
    const previous = global.__LYNX_XML_AGENT_SERVICE__;
    global.__LYNX_XML_AGENT_SERVICE__ = {
      streamAsAsyncIterable: () =>
        Promise.resolve({
          textStream: Readable.from([]),
          finalize: () =>
            Promise.resolve({
              text: ARTIFACT,
              usage: { inputTokens: 5 },
              finishReason: 'error',
            }),
        }),
    };
    try {
      const response = await app.request('/lynx-xml/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const body = await response.text();
      expect(body).toContain(
        'Upstream model generation failed without error details',
      );
      expect(body).toContain('"inputTokens":5');
      expect(body).not.toContain('event: done');
    } finally {
      global.__LYNX_XML_AGENT_SERVICE__ = previous;
    }
  });

  test('includes usage and reason when final fragment compilation fails', async () => {
    const global = globalThis as GlobalWithLynxXmlService;
    const previous = global.__LYNX_XML_AGENT_SERVICE__;
    global.__LYNX_XML_AGENT_SERVICE__ = {
      streamAsAsyncIterable: () =>
        Promise.resolve({
          textStream: Readable.from([ARTIFACT]),
          finalize: () =>
            Promise.reject(
              new GenerationPostprocessError(
                new Error('Invalid XML fragment'),
                {
                  text: ARTIFACT,
                  usage: { inputTokens: 12, outputTokens: 8 },
                  finishReason: 'stop',
                },
              ),
            ),
        }),
    };
    try {
      const response = await app.request('/lynx-xml/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          enableHtmlFragment: true,
        }),
      });
      const body = await response.text();
      expect(body).toContain('event: error');
      expect(body).not.toContain('event: done');
      expect(body).toContain('Invalid XML fragment');
      expect(body).toContain('"inputTokens":12');
      expect(body).toContain('"finishReason":"stop"');
    } finally {
      global.__LYNX_XML_AGENT_SERVICE__ = previous;
    }
  });
  test.each([undefined, false, true])(
    'forwards the fragment choice with default off: %s',
    async (enabled) => {
      const global = globalThis as GlobalWithLynxXmlService;
      const previous = global.__LYNX_XML_AGENT_SERVICE__;
      let received: LynxXmlChatOptions | undefined;
      global.__LYNX_XML_AGENT_SERVICE__ = {
        streamAsAsyncIterable(_messages, options) {
          received = options;
          return Promise.resolve({
            textStream: Readable.from([ARTIFACT]),
            finalize: () =>
              Promise.resolve({
                text: ARTIFACT,
                usage: undefined,
                finishReason: 'stop',
              }),
          });
        },
      };
      try {
        const response = await app.request('/lynx-xml/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            enableHtmlFragment: enabled,
          }),
        });
        expect(await response.text()).toContain('event: done');
        expect(received?.enableHtmlFragment).toBe(enabled === true);
      } finally {
        global.__LYNX_XML_AGENT_SERVICE__ = previous;
      }
    },
  );
  test('rejects non-boolean fragment options', async () => {
    const response = await app.request('/lynx-xml/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        enableHtmlFragment: 'true',
      }),
    });
    expect(response.status).toBe(400);
  });
  test.each([undefined, {
    xmlFragment: '<view>\n  <text>Hello &amp; 你好</text>\n</view>',
    modelOutput: '<!doctype lynx>\n<!-- original model response -->',
  }])(
    'streams deltas and passes optional metadata alongside the normalized artifact: %j',
    async (metadata) => {
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
                ...(metadata ? { metadata } : {}),
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
        const doneFrame = body.split('\n\n').find((frame) =>
          frame.startsWith('event: done\n')
        );
        expect(doneFrame).toBeDefined();
        const done = JSON.parse(
          doneFrame!.slice('event: done\ndata: '.length),
        ) as Record<string, unknown>;
        if (metadata) expect(done.metadata).toEqual(metadata);
        else expect(done).not.toHaveProperty('metadata');
      } finally {
        global.__LYNX_XML_AGENT_SERVICE__ = previous;
      }
    },
  );

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
