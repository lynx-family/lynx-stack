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
const REASONING = 'Plan the greeting layout.';

function modelResponse(
  api: 'chat' | 'responses',
  exhausted: boolean,
  incompleteReason: string,
  streaming: boolean,
) {
  const text = exhausted ? '' : DOCUMENT;
  const usage = {
    input_tokens: exhausted ? 8010 : 8020,
    output_tokens: exhausted ? 32768 : 200,
    input_tokens_details: { cached_tokens: exhausted ? 6144 : 0 },
    output_tokens_details: { reasoning_tokens: exhausted ? 32768 : 20 },
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
    const reasoningItem = {
      id: 'reasoning-1',
      type: 'reasoning',
      summary: [],
      content: [{ type: 'reasoning_text', text: REASONING }],
    };
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
      output: exhausted ? [reasoningItem] : [item],
      usage,
      ...(exhausted
        ? { incomplete_details: { reason: incompleteReason } }
        : {}),
    };
    if (!streaming) return Response.json(response);
    chunks = [
      { type: 'response.created', response },
      ...(exhausted
        ? [
          {
            type: 'response.output_item.added',
            output_index: 0,
            item: reasoningItem,
          },
          {
            type: 'response.reasoning_text.delta',
            output_index: 0,
            item_id: reasoningItem.id,
            content_index: 0,
            delta: REASONING,
          },
          {
            type: 'response.output_item.done',
            output_index: 0,
            item: reasoningItem,
          },
        ]
        : [
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

test.each(
  [
    ['chat', 'length', 'stream'],
    ['responses', 'max_output_tokens', 'stream'],
    // An arbitrary provider reason maps to `other`; do not assume Ark's raw value.
    ['responses', 'provider_limit', 'stream'],
    ['responses', 'provider_limit', 'generate'],
  ] as const,
)(
  'stops after reasoning-only output until another request is made (%s, %s, %s)',
  async (api, incompleteReason, method) => {
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
      return Promise.resolve(
        modelResponse(
          api,
          requests.length === 1,
          incompleteReason,
          body.stream === true,
        ),
      );
    });
    const log = rstest.fn();
    const onReasoning = rstest.fn<(text: string) => void>();
    const options = {
      model: 'Selected',
      enableWebSearch: false,
      enableImageGeneration: false,
      enableHtmlFragment: true,
      onPerformanceEvent: log,
      onReasoning,
    };
    const service = new LynxXmlAgentService();
    const generate = async () => {
      const messages = [{
        role: 'user' as const,
        content: 'Generate a greeting.',
      }];
      if (method === 'generate') return service.generateRaw(messages, options);
      const result = await service.streamAsAsyncIterable(messages, options);
      let streamed = '';
      for await (const chunk of result.textStream) streamed += chunk;
      if (requests.length === 1) expect(streamed).toBe('');
      return result.finalize();
    };
    const finishReason = incompleteReason === 'provider_limit'
      ? 'other'
      : 'length';
    const generation = generate();
    await expect(generation).rejects.toThrow(
      finishReason === 'other'
        ? 'Model returned reasoning but no final artifact'
        : 'Model output reached its token limit',
    );
    await expect(generation).rejects.toMatchObject({
      name: 'GenerationPostprocessError',
      result: {
        text: '',
        finishReason,
        usage: {
          inputTokens: 8010,
          outputTokens: 32768,
          reasoningTokens: 32768,
        },
      },
    });
    expect(requests).toHaveLength(1);
    const steps = log.mock.calls.filter(([event]) =>
      event === 'agent.model.step.completed'
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]?.[1]).toMatchObject({
      finishReason,
      toolCalls: [],
      outputTextChars: 0,
      ...(api === 'responses' ? { reasoningTextChars: REASONING.length } : {}),
    });
    if (api === 'responses') {
      expect(onReasoning.mock.calls.map(([text]) => text).join('').trim())
        .toBe(REASONING);
    }
    expect(log.mock.calls.some(([event]) => event === 'agent.recovery.started'))
      .toBe(false);

    // A new explicit request can succeed without changing its budget or effort.
    const final = await generate();
    expect(final.text).toContain('__CreateView(pageId)');
    expect(final.metadata.modelOutput).toBe(DOCUMENT);
    expect(requests).toHaveLength(2);
    const budgetKey = api === 'responses'
      ? 'max_output_tokens'
      : 'max_completion_tokens';
    expect(requests.map(request => request[budgetKey])).toEqual([32768, 32768]);
    expect(requests.map(request =>
      api === 'responses'
        ? (request.reasoning as { effort: string }).effort
        : request.reasoning_effort
    )).toEqual(['high', 'high']);
  },
);
