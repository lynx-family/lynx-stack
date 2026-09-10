// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import { createA2UIBenchAdapter } from '../service/a2ui/a2ui-bench-adapter.js';
import { resolveBenchCatalog } from '../service/a2ui/a2ui-bench-catalog.js';
import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import { GenerationUpstreamError } from '../service/common/result.js';
import { createLynxXmlBenchAdapter } from '../service/lynx-xml/lynx-xml-bench-adapter.js';
import { createOpenUIBenchAdapter } from '../service/openui/openui-bench-adapter.js';

const model = 'bench-retry-model';
const baseURL = 'https://bench-retry.example/v1';
const input: ProtocolBenchAdapterInput = {
  runId: 'retry-run',
  pairId: 'retry-pair',
  scenario: {
    id: 'greeting',
    name: 'Greeting',
    type: 'Information',
    complexity: 1,
    prompt: 'Show Hello',
  },
  repeatIndex: 1,
  maxAttempts: 4,
  provider: { model: 'Retry' },
};
const protocols = [
  ['a2ui', createA2UIBenchAdapter, () =>
    JSON.stringify([
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'main',
          catalogId: `${resolveBenchCatalog('Full Catalog').id}#matched-core`,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [{
            id: 'root',
            component: 'Text',
            text: 'Hello',
            variant: 'body',
          }],
        },
      },
    ])],
  ['openui', createOpenUIBenchAdapter, () => 'root = Column([Text("Hello")])'],
  [
    'lynx-xml',
    createLynxXmlBenchAdapter,
    () =>
      '<!doctype lynx><lynx engine-version="4.2"><script thread="main">const page = __CreatePage("0", 0);</script></lynx>',
  ],
] as const;

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each(protocols)(
  '%s retains usage from failed generations across retries',
  async (_name, create, output) => {
    let calls = 0;
    const adapter = create({
      retryDelayMs: 0,
      generateRaw() {
        if (++calls === 1) {
          throw new GenerationUpstreamError({ statusCode: 503 }, {
            text: 'partial output',
            usage: { inputTokens: 8, outputTokens: 3 },
            finishReason: 'error',
          });
        }
        return Promise.resolve({
          text: output(),
          usage: { inputTokens: 10, outputTokens: 2 },
          finishReason: 'stop',
        });
      },
    });
    const result = await adapter.generate(input);
    expect(result.finalValid).toBe(true);
    expect(result.attempts.map(attempt => attempt.totalTokens)).toEqual([
      11,
      12,
    ]);
    expect(result.attempts[0]).toMatchObject({
      finishReason: 'error',
      outputChars: 'partial output'.length,
    });
  },
);

function configure(api: 'chat' | 'responses') {
  rstest.stubEnv(
    GENUI_MODEL_CONFIG_ENV,
    JSON.stringify({
      Retry: {
        apiKey: 'test-secret',
        baseURL,
        model,
        api,
        reasoningEffort: 'low',
      },
    }),
  );
  rstest.spyOn(console, 'info').mockImplementation(() => undefined);
  rstest.spyOn(console, 'error').mockImplementation(() => undefined);
}

function modelResponse(
  api: 'chat' | 'responses',
  text: string,
  streaming: boolean,
): Response {
  let chunks: unknown[];
  if (api === 'chat') {
    const response = {
      id: 'chat-1',
      model,
      created: 1,
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    };
    if (!streaming) {
      return Response.json({
        ...response,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop',
        }],
      });
    }
    chunks = [{
      ...response,
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: text },
        finish_reason: null,
      }],
    }, {
      ...response,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    }];
  } else {
    const item = {
      id: 'message-1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text, annotations: [] }],
    };
    const response = {
      id: 'response-1',
      object: 'response',
      model,
      created_at: 1,
      status: 'completed',
      output: [item],
      usage: { input_tokens: 10, output_tokens: 2 },
    };
    if (!streaming) return Response.json(response);
    chunks = [
      { type: 'response.created', response },
      { type: 'response.output_item.added', output_index: 0, item },
      {
        type: 'response.output_text.delta',
        output_index: 0,
        item_id: item.id,
        delta: text,
      },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response },
    ];
  }
  return new Response(
    chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
    {
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

for (const api of ['chat', 'responses'] as const) {
  test.each(protocols)(
    `%s ${api} retries only at the adapter layer and honors provider backoff`,
    async (_name, create, output) => {
      configure(api);
      const calls: string[] = [];
      const waits: number[] = [];
      rstest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON body');
        }
        calls.push(init.body);
        // A second SDK request before the adapter wait would violate the budget.
        expect(calls.length).toBe(waits.length + 1);
        const status = calls.length === 1 ? 429 : 503;
        return Promise.resolve(
          calls.length < 3
            ? Response.json({
              error: { message: 'Try later', type: 'server_error' },
            }, {
              status,
              headers: calls.length === 1 ? { 'Retry-After': '3' } : {},
            })
            : modelResponse(
              api,
              output(),
              (JSON.parse(init.body) as { stream?: boolean }).stream === true,
            ),
        );
      });
      const adapter = create({
        sleep(delay) {
          waits.push(delay);
          return Promise.resolve();
        },
      });
      const result = await adapter.generate(input);
      expect(calls).toHaveLength(3);
      expect(waits).toEqual([3_000, 2_000]);
      expect(result.finalErrors).toEqual([]);
      expect(result.finalValid).toBe(true);
      expect(result.attempts.map(attempt => attempt.valid)).toEqual([
        false,
        false,
        true,
      ]);
      expect(result.attempts[2]?.totalTokens).toBe(12);
      expect(calls.every(body => body === calls[0])).toBe(true);
    },
  );

  test.each(protocols)(
    `%s ${api} stops on permanent HTTP errors without sleeping`,
    async (_name, create, _output) => {
      configure(api);
      const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          Response.json({ error: { message: 'Invalid credentials' } }, {
            status: 401,
            headers: { 'Retry-After': '1', 'x-secret': 'must-not-leak' },
          }),
        )
      );
      const sleep = rstest.fn(() => Promise.resolve());
      const result = await create({ sleep }).generate(input);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(result.attempts).toHaveLength(1);
      expect(result.finalValid).toBe(false);
      expect(result.judgePayload).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('must-not-leak');
    },
  );
}
