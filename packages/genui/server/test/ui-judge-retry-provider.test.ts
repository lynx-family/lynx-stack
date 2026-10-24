// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';

import { createJudgeScores } from './ui-judge-fixtures.js';
import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import * as requestQueue from '../agent/common/ui-judge-request-queue.js';
import { runBenchUiJudgeRequest } from '../service/a2ui/a2ui-bench-judge.js';
import { convertCapturedBmp } from '../service/common/bench/screenshot.js';
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
  scores: unknown = createJudgeScores(),
): Response {
  const text = JSON.stringify(scores);
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
  scores: unknown = createJudgeScores(),
  expectedImageUrl = screenshotDataUrl,
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
    expect(raw.split(expectedImageUrl)).toHaveLength(2);
    const status = failures[calls.length - 1];
    if (status) {
      return Promise.resolve(Response.json({
        error: { message: `Provider HTTP ${status}`, type: 'server_error' },
      }, {
        status,
        ...(status === 429 ? { headers: { 'Retry-After': '3' } } : {}),
      }));
    }
    return Promise.resolve(success(api, body.stream === true, scores));
  });
  return { calls };
}

for (const api of ['chat', 'responses'] as const) {
  test(`${api} reuses one Bench capture when retrying all scores`, async () => {
    const bmp = Buffer.from(
      'Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AP8AgP8AAAA8KBT/',
      'base64',
    );
    const imageUrl = await convertCapturedBmp(bmp);
    expect(imageUrl).toBeDefined();
    const { calls } = mockProvider(api, [429], createJudgeScores(), imageUrl!);
    const capture = rstest.fn(() =>
      Promise.resolve(
        new Response(bmp, {
          headers: { 'Content-Type': 'image/bmp' },
        }),
      )
    );
    const result = await runBenchUiJudgeRequest({
      model: 'Judge',
      globalProps: {},
      includeScreenshot: true,
      scenario: { prompt: 'Show a greeting' },
      session: {
        screenshotPath: 'screenshot/zip/url',
        zipUrl: 'https://assets.example/a2ui.lynx.zip',
      },
    }, capture);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(new Set(calls.map(call => call.body)).size).toBe(1);
    expect(result).toMatchObject({
      status: 'complete',
      score: 4,
      geqiScore: 80,
      screenshotDataUrl: imageUrl,
      errors: [],
    });
    expect(result.dimensions).toHaveLength(4);
  });

  test(`${api} returns all five scores with one request and one image`, async () => {
    const { calls } = mockProvider(api, [], createJudgeScores([4, 5, 4, 3, 2]));
    const result = await evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    });
    expect(calls).toHaveLength(1);
    expect(result.score).toBe(4);
    expect(result.dimensions.map(({ score }) => score)).toEqual([5, 4, 3, 2]);
    expect(result.geqiScore).toBeCloseTo(65 / 85 * 100);
    expect(waits).toEqual([]);
    const body = JSON.parse(calls[0]!.body) as Record<string, unknown>;
    expect(api === 'chat' ? body.max_completion_tokens : body.max_output_tokens)
      .toBe(4096);
  });

  test(`${api} validates JSON scores locally without native json_schema support`, async () => {
    const { calls } = mockProvider(
      api,
      [],
      createJudgeScores([4, 4, 4, 4, 4.5]),
    );
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  test(`${api} rejects incomplete score groups`, async () => {
    const scores = createJudgeScores();
    delete scores['architecture-writing'];
    const { calls } = mockProvider(api, [], scores);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  test(`${api} retries the complete scoring request with no nested SDK retries`, async () => {
    const { calls } = mockProvider(api, [429, 503]);
    const result = await evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    });
    expect(result).toMatchObject({ score: 4, geqiScore: 80 });
    expect(result.dimensions).toHaveLength(4);
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([3_000, 2_000]);
    expect(calls.map(call => call.time)).toEqual([0, 3_000, 5_000]);
    expect(new Set(calls.map(call => call.body)).size).toBe(1);
  });

  test(`${api} stops after three attempts on persistently limited scoring`, async () => {
    const { calls } = mockProvider(api, [429, 429, 429, 429]);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow('Provider HTTP 429');
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([3_000, 3_000]);
  });

  test(`${api} stops immediately on authentication failures`, async () => {
    const { calls } = mockProvider(api, [401]);
    await expect(evaluateScreenshot({
      model: 'Judge',
      screenshotDataUrl,
      task: 'Show a greeting',
    })).rejects.toThrow('Provider HTTP 401');
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });
}
