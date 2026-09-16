// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import LynxXmlAgentService from '../service/lynx-xml/lynx-xml-agent.js';

const BASE_URL = 'https://reasoning-provider.example/v1';
const MODEL = 'same-upstream-model';
const DOCUMENT =
  '<!doctype lynx><lynx engine-version="4.2"><template><view><text><raw-text text="Hello"/></text></view></template><script thread="main">const page = __CreatePage("0", 0); const pageId = __GetElementUniqueID(page); createFragment(page, pageId);</script></lynx>';

function modelResponse(api: 'chat' | 'responses', exhausted: boolean) {
  const text = exhausted ? '' : DOCUMENT;
  const usage = {
    input_tokens: exhausted ? 8010 : 8020,
    output_tokens: exhausted ? 16384 : 200,
    input_tokens_details: { cached_tokens: exhausted ? 6144 : 0 },
    output_tokens_details: { reasoning_tokens: exhausted ? 16384 : 20 },
  };
  let chunks: unknown[];
  if (api === 'chat') {
    const response = {
      id: 'chat-1',
      created: 1,
      model: MODEL,
      object: 'chat.completion.chunk',
    };
    chunks = [
      {
        ...response,
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: text },
          finish_reason: null,
        }],
      },
      {
        ...response,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: exhausted ? 'length' : 'stop',
        }],
        usage: {
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
          prompt_tokens_details: usage.input_tokens_details,
          completion_tokens_details: usage.output_tokens_details,
        },
      },
    ];
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
      model: MODEL,
      created_at: 1,
      status: exhausted ? 'incomplete' : 'completed',
      output: exhausted ? [] : [item],
      usage,
      ...(exhausted
        ? { incomplete_details: { reason: 'max_output_tokens' } }
        : {}),
    };
    chunks = [
      { type: 'response.created', response },
      ...(exhausted ? [] : [
        { type: 'response.output_item.added', output_index: 0, item },
        {
          type: 'response.output_text.delta',
          output_index: 0,
          item_id: item.id,
          delta: text,
        },
        { type: 'response.output_item.done', output_index: 0, item },
      ]),
      {
        type: exhausted ? 'response.incomplete' : 'response.completed',
        response,
      },
    ];
  }
  return new Response(
    chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
    {
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each(['chat', 'responses'] as const)(
  'recovers reasoning exhaustion through real Mastra and %s requests without changing the model',
  async api => {
    rstest.stubEnv(
      GENUI_MODEL_CONFIG_ENV,
      JSON.stringify({
        Selected: {
          model: MODEL,
          apiKey: 'test-secret',
          baseURL: BASE_URL,
          api,
          reasoningEffort: 'high',
          maxOutputTokens: 32768,
        },
      }),
    );
    const requests: Record<string, unknown>[] = [];
    rstest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      if (typeof init?.body !== 'string') {
        throw new TypeError('Expected a JSON request body');
      }
      const body = JSON.parse(init.body) as Record<string, unknown>;
      requests.push(body);
      return Promise.resolve(modelResponse(api, requests.length === 1));
    });
    const log = rstest.fn();
    const options = {
      model: 'Selected',
      enableWebSearch: false,
      enableImageGeneration: false,
      enableHtmlFragment: true,
      onPerformanceEvent: log,
    };
    const service = new LynxXmlAgentService();
    const result = await service.streamAsAsyncIterable([
      { role: 'user', content: 'Generate a greeting.' },
    ], options);
    let streamed = '';
    for await (const chunk of result.textStream) streamed += chunk;
    expect(streamed).toBe('');
    const final = await result.finalize();
    expect(final.text).toContain('__CreateView(pageId)');
    expect(final.text).toMatch(/<\/lynx>$/);
    expect(final.metadata.modelOutput).toBe(DOCUMENT);
    expect(final.metadata).toMatchObject({
      generationAttempts: [
        { mode: 'initial', finishReason: 'length' },
        { mode: 'regenerate', finishReason: 'stop' },
      ],
    });
    expect(final.usage).toMatchObject({
      inputTokens: 16030,
      outputTokens: 16584,
      reasoningTokens: 16404,
    });
    expect(requests).toHaveLength(2);
    const budgetKey = api === 'responses'
      ? 'max_output_tokens'
      : 'max_completion_tokens';
    expect(requests.map(request => request[budgetKey])).toEqual([16384, 32768]);
    const efforts = requests.map(request =>
      api === 'responses'
        ? (request.reasoning as { effort: string }).effort
        : request.reasoning_effort
    );
    expect(efforts).toEqual(['high', 'low']);
    for (const request of requests) {
      expect(request.model).toBe(MODEL);
      const messages =
        (api === 'responses' ? request.input : request.messages) as {
          role: string;
          content: unknown;
        }[];
      expect(messages.some(message => message.role === 'assistant')).toBe(
        false,
      );
      expect(JSON.stringify(messages)).toContain('Generate a greeting.');
    }
    expect(log).toHaveBeenCalledWith(
      'agent.recovery.started',
      expect.objectContaining({
        reason: 'reasoning-only-output',
        maxOutputTokens: 32768,
        reasoningEffort: 'low',
      }),
    );
    // Cached agents must not retain the recovery override on the next request.
    const next = await service.streamAsAsyncIterable([
      { role: 'user', content: 'Generate another greeting.' },
    ], options);
    for await (const _chunk of next.textStream) { /* drain */ }
    await next.finalize();
    expect(requests[2]?.[budgetKey]).toBe(16384);
    expect(
      api === 'responses'
        ? requests[2]?.reasoning
        : requests[2]?.reasoning_effort,
    )
      .toEqual(api === 'responses' ? { effort: 'high' } : 'high');
  },
);
