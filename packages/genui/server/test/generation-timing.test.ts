// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import { BASIC_CATALOG } from '../agent/a2ui/a2ui-catalog.js';
import { publishA2UIPayload } from '../app/a2ui/payload-publisher.js';
import * as publisher from '../app/a2ui/payload-publisher.js' with {
  rstest: 'importActual',
};
import app from '../src/app.js';

rstest.mock('../app/a2ui/payload-publisher.js', () => ({
  ...publisher,
  publishA2UIPayload: rstest.fn(),
}));

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllGlobals();
});

const messages = [{
  version: 'v0.9',
  createSurface: { surfaceId: 'main', catalogId: BASIC_CATALOG.id },
}, {
  version: 'v0.9',
  updateComponents: {
    surfaceId: 'main',
    components: [{ id: 'root', component: 'Text', text: 'Hello' }],
  },
}];

function request(path: string, repair = false) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.225',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Create a greeting' }],
      action: { name: 'refresh' },
      surfaceId: 'main',
      catalog: BASIC_CATALOG,
      ...(repair ? { maxRepairAttempts: 1 } : {}),
    }),
  });
}

function eventPayload(body: string, name: string) {
  const frame = body.split('\n\n').find(item =>
    item.startsWith(`event: ${name}\n`)
  );
  expect(frame).toBeDefined();
  return JSON.parse(frame!.split('\ndata: ')[1]!) as {
    metrics: { generationMs: number };
    validation?: { ok: boolean };
  };
}

test.each(
  [
    ['/a2ui/stream', false],
    ['/a2ui/action/stream', false],
    ['/a2ui/stream', true],
    ['/a2ui/action/stream', true],
  ] as const,
)(
  '%s measures generation and repair before a delayed upload (repair: %s)',
  async (path, repair) => {
    let now = 1_000;
    rstest.spyOn(performance, 'now').mockImplementation(() => now);
    const text = JSON.stringify(messages);
    rstest.stubGlobal('__A2UI_AGENT_SERVICE__', {
      streamAsAsyncIterable() {
        now += 120;
        return Promise.resolve({
          textStream: (async function*() {
            await Promise.resolve();
            now += 250;
            yield repair ? 'invalid artifact' : text;
          })(),
          finalize() {
            now += 130;
            return Promise.resolve({
              text: repair ? 'invalid artifact' : text,
              finishReason: 'stop',
            });
          },
        });
      },
      generateValidated() {
        now += 350;
        return Promise.resolve({
          ok: true,
          text,
          messages,
          errors: [],
          warnings: [],
          attempts: 1,
          finishReason: 'stop',
        });
      },
    });
    let releaseUpload: (() => void) | undefined;
    const upload = new Promise<void>(resolve => {
      releaseUpload = resolve;
    });
    rstest.mocked(publishA2UIPayload).mockImplementation(async () => {
      await upload;
      now += 9_000;
      return { messagesUrl: 'https://cdn.example.com/messages.json' };
    });
    const response = await request(path, repair);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let body = '';
    try {
      while (!body.includes('event: metrics\n')) {
        const chunk = await reader.read();
        expect(chunk.done).toBe(false);
        body += decoder.decode(chunk.value);
      }
      expect(body).not.toContain('event: done');
      expect(publishA2UIPayload).toHaveBeenCalledWith(messages);
      expect(eventPayload(body, 'metrics').metrics.generationMs).toBe(
        repair ? 850 : 500,
      );
    } finally {
      releaseUpload?.();
    }
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      body += decoder.decode(chunk.value);
    }
    const done = eventPayload(body, 'done');
    expect(done.validation?.ok).toBe(true);
    expect(done.metrics).toEqual(eventPayload(body, 'metrics').metrics);
    expect(now).toBe(repair ? 10_850 : 10_500);
  },
);

test.each([
  ['/a2ui/stream', '__A2UI_AGENT_SERVICE__'],
  ['/a2ui/action/stream', '__A2UI_AGENT_SERVICE__'],
  ['/html/stream', '__HTML_AGENT_SERVICE__'],
  ['/openui/stream', '__OPENUI_AGENT_SERVICE__'],
  ['/lynx-xml/stream', '__LYNX_XML_AGENT_SERVICE__'],
])('%s retains time spent on a failed generation', async (path, serviceKey) => {
  let now = 100;
  rstest.spyOn(performance, 'now').mockImplementation(() => now);
  rstest.stubGlobal(serviceKey, {
    streamAsAsyncIterable() {
      now += 580;
      return Promise.reject(new Error('Generation failed'));
    },
  });
  const response = await request(path);
  const body = await response.text();
  expect(body).not.toContain('event: done');
  expect(eventPayload(body, 'error').metrics).toEqual({ generationMs: 580 });
});
