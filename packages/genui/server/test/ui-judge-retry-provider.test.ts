// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';

import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import * as requestQueue from '../agent/common/ui-judge-request-queue.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

const model = 'judge-upstream';
const baseURL = 'https://judge-retry.example/v1';
const screenshotDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
let previousConfig: string | undefined;
let now: number;
let waits: number[];

beforeEach(() => {
  previousConfig = process.env[GENUI_MODEL_CONFIG_ENV];
  now = 0;
  waits = [];
  rstest.spyOn(requestQueue, 'getUiJudgeRequestQueue').mockReturnValue(
    new requestQueue.UiJudgeRequestQueue({
      intervalMs: 0,
      now: () => now,
      sleep: (delay) => {
        waits.push(delay);
        now += delay;
        return Promise.resolve();
      },
    }),
  );
  rstest.spyOn(console, 'info').mockImplementation(() => undefined);
  rstest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  rstest.restoreAllMocks();
  if (previousConfig === undefined) delete process.env[GENUI_MODEL_CONFIG_ENV];
  else process.env[GENUI_MODEL_CONFIG_ENV] = previousConfig;
});

function success(
  api: 'chat' | 'responses',
  streaming: boolean,
  score = 4,
): Response {
  const text = JSON.stringify({
    score,
    reason: 'Visible evidence.',
    summary: 'Clear layout.',
  });
  let chunks: unknown[];
  if (api === 'chat') {
    const response = {
      id: 'chat-1',
      model,
      created: 1,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
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
      usage: { input_tokens: 10, output_tokens: 20 },
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
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function mockProvider(
  api: 'chat' | 'responses',
  failures: number[],
  score = 4,
) {
  process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify({
    Judge: {
      model,
      apiKey: 'judge-test-key',
      baseURL,
      api,
      reasoningEffort: 'low',
    },
  });
  const calls: Array<{ body: string; time: number }> = [];
  const limitedCalls: typeof calls = [];
  const originalFetch = globalThis.fetch;
  rstest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.startsWith('data:image/png;base64,')) {
      return originalFetch(input, init);
    }
    expect(url).toBe(
      `${baseURL}/${api === 'chat' ? 'chat/completions' : 'responses'}`,
    );
    const raw = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(raw) as Record<string, unknown>;
    // These endpoints support plain JSON text, but no native JSON-schema mode.
    expect(body.response_format).toBeUndefined();
    expect((body.text as { format?: unknown } | undefined)?.format)
      .toBeUndefined();
    const call = { body: raw, time: now };
    calls.push(call);
    expect(body.model).toBe(model);
    if (api === 'chat') expect(body.reasoning_effort).toBe('low');
    else expect(body.reasoning).toEqual({ effort: 'low' });
    if (raw.includes('Dimension: Visual Correctness')) {
      limitedCalls.push(call);
      const status = failures[limitedCalls.length - 1];
      if (status) {
        return Promise.resolve(Response.json({
          error: { message: `Provider HTTP ${status}`, type: 'server_error' },
        }, {
          status,
          ...(status === 429 ? { headers: { 'Retry-After': '3' } } : {}),
        }));
      }
    }
    return Promise.resolve(success(api, body.stream === true, score));
  });
  return { calls, limitedCalls };
}

for (const api of ['chat', 'responses'] as const) {
  test(`${api} validates JSON scores locally without native json_schema support`, async () => {
    const { calls } = mockProvider(api, [], 4.5);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(5);
    expect(waits).toEqual([]);
  });

  test(`${api} retries only the failed dimension with no nested SDK retries`, async () => {
    const { calls, limitedCalls } = mockProvider(api, [429, 503]);
    const result = await evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    });
    expect(result).toMatchObject({ score: 4, geqiScore: 80 });
    expect(result.dimensions).toHaveLength(4);
    expect(calls).toHaveLength(7);
    expect(limitedCalls).toHaveLength(3);
    expect(waits).toEqual([3_000, 2_000]);
    expect(limitedCalls.map(call => call.time)).toEqual([0, 3_000, 5_000]);
    expect(new Set(limitedCalls.map(call => call.body)).size).toBe(1);
  });

  test(`${api} stops after three attempts on a persistently limited dimension`, async () => {
    const { calls, limitedCalls } = mockProvider(api, [429, 429, 429, 429]);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow('Provider HTTP 429');
    expect(limitedCalls).toHaveLength(3);
    expect(calls).toHaveLength(7);
    expect(waits).toEqual([3_000, 3_000]);
  });

  test(`${api} stops immediately on authentication failures`, async () => {
    const { limitedCalls } = mockProvider(api, [401]);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow('Provider HTTP 401');
    expect(limitedCalls).toHaveLength(1);
    expect(waits).toEqual([]);
  });
}
