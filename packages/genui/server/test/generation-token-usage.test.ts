// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { describe, expect, test } from '@rstest/core';

import { BASIC_CATALOG } from '../agent/a2ui/a2ui-catalog.js';
import { createTextStreamRoute } from '../app/common/text-stream-route.js';
import app from '../src/app.js';

const usage = {
  inputTokens: { total: 100, cacheRead: 60, cacheWrite: 10 },
  outputTokens: { total: 20, reasoning: 8 },
};
const tokenUsage = {
  inputTokens: 100,
  cachedTokens: 60,
  outputTokens: 20,
  totalTokens: 120,
  cacheWriteTokens: 10,
  reasoningTokens: 8,
};
const a2uiText = JSON.stringify([
  {
    version: 'v0.9',
    createSurface: { surfaceId: 'main', catalogId: BASIC_CATALOG.id },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        { id: 'root', component: 'Text', text: 'Ready', variant: 'body' },
      ],
    },
  },
]);

function streamed(text: string) {
  return Promise.resolve({
    textStream: Readable.from([text]),
    finalize: () => Promise.resolve({ text, usage, finishReason: 'stop' }),
  });
}

function doneFrame(body: string): Record<string, unknown> {
  const frame = body.split('\n\n').find(frame =>
    frame.startsWith('event: done\n')
  );
  expect(frame).toBeDefined();
  return JSON.parse(frame!.slice('event: done\ndata: '.length)) as Record<
    string,
    unknown
  >;
}

describe('generation token usage on the wire', () => {
  test.each(
    [
      ['/a2ui/chat', false],
      ['/a2ui/chat', true],
      ['/a2ui/action', true],
      ['/a2ui/stream', true],
      ['/a2ui/action/stream', true],
    ] as const,
  )(
    'returns every price dimension for %s (validate=%s)',
    async (path, validate) => {
      const global = globalThis as typeof globalThis & {
        __A2UI_AGENT_SERVICE__?: unknown;
      };
      const previous = global.__A2UI_AGENT_SERVICE__;
      global.__A2UI_AGENT_SERVICE__ = {
        generateRaw: () =>
          Promise.resolve({ text: a2uiText, usage, finishReason: 'stop' }),
        generateValidated: () =>
          Promise.resolve({
            ok: true,
            text: a2uiText,
            usage,
            messages: [],
            errors: [],
            warnings: [],
            attempts: 1,
          }),
        streamAsAsyncIterable: () => streamed(a2uiText),
      };
      try {
        const response = await app.request(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.180',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Create a card' }],
            action: { name: 'refresh' },
            surfaceId: 'main',
            catalog: BASIC_CATALOG,
            validate,
          }),
        });
        const payload: unknown = path.endsWith('/stream')
          ? doneFrame(await response.text())
          : await response.json();
        expect(payload).toMatchObject({ usage, tokenUsage });
      } finally {
        global.__A2UI_AGENT_SERVICE__ = previous;
      }
    },
  );

  test.each([true, false])(
    'counts the initial A2UI stream and all repair usage (repair ok=%s)',
    async ok => {
      const global = globalThis as typeof globalThis & {
        __A2UI_AGENT_SERVICE__?: unknown;
      };
      const previous = global.__A2UI_AGENT_SERVICE__;
      global.__A2UI_AGENT_SERVICE__ = {
        streamAsAsyncIterable: () => streamed('invalid artifact'),
        generateValidated: () =>
          Promise.resolve({
            ok,
            text: a2uiText,
            usage,
            messages: [],
            errors: [],
            warnings: [],
            attempts: 1,
          }),
      };
      try {
        for (const path of ['/a2ui/stream', '/a2ui/action/stream']) {
          const response = await app.request(path, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '203.0.113.181',
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Create a card' }],
              action: { name: 'refresh' },
              surfaceId: 'main',
              catalog: BASIC_CATALOG,
            }),
          });
          expect(doneFrame(await response.text())).toMatchObject({
            tokenUsage: {
              inputTokens: 200,
              cachedTokens: 120,
              outputTokens: 40,
              totalTokens: 240,
              cacheWriteTokens: 20,
              reasoningTokens: 16,
            },
          });
        }
      } finally {
        global.__A2UI_AGENT_SERVICE__ = previous;
      }
    },
  );

  test.each([false, true])(
    'preserves priced usage on shared text stream completion or validation error (%s)',
    async invalid => {
      const route = createTextStreamRoute({
        scope: 'pricing-test',
        path: '/stream',
        getService: () => ({
          streamAsAsyncIterable: () => streamed('artifact'),
        }),
        normalizeFinalText: text => {
          if (invalid) throw new Error('invalid artifact');
          return text;
        },
      });
      const response = await route.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.182',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Generate' }],
        }),
      });
      const body = await response.text();
      const payload = invalid
        ? JSON.parse(
          body.split('\n\n').find(frame => frame.startsWith('event: error\n'))!
            .slice('event: error\ndata: '.length),
        ) as unknown
        : doneFrame(body);
      expect(payload).toMatchObject({ usage, tokenUsage });
    },
  );
});
