// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import A2UIAgentService from '../service/a2ui/a2ui-agent.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import HtmlAgentService from '../service/html/html-agent.js';
import LynxXmlAgentService from '../service/lynx-xml/lynx-xml-agent.js';
import { McpAppsAgentService } from '../service/mcp-apps/mcp-apps-agent.js';
import OpenUIAgentService from '../service/openui/openui-agent.js';

const baseURL = 'https://reasoning-provider.example/v1';
const model = 'ep-test-reasoning';
const content = '[]';
const messages = [{ role: 'user' as const, content: 'Generate a page.' }];
const services = [
  ['a2ui', () => new A2UIAgentService()],
  ['openui', () => new OpenUIAgentService()],
  ['html', () => new HtmlAgentService()],
  ['lynx-xml', () => new LynxXmlAgentService()],
  ['mcp-apps', () => new McpAppsAgentService()],
] as const;

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

function streamResponse(chunks: unknown[]): Response {
  return new Response(
    chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function modelResponse(
  api: 'chat' | 'responses',
  streaming: boolean,
): Response {
  if (api === 'chat') {
    const response = {
      id: 'chat-response',
      model,
      created: 1,
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    };
    return streaming
      ? streamResponse([{
        ...response,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: { role: 'assistant', content },
          finish_reason: null,
        }],
      }, {
        ...response,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }])
      : Response.json({
        ...response,
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        }],
      });
  }
  const item = {
    id: 'message-1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: content, annotations: [] }],
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
  return streaming
    ? streamResponse([
      { type: 'response.created', response },
      { type: 'response.output_item.added', output_index: 0, item },
      {
        type: 'response.output_text.delta',
        output_index: 0,
        item_id: item.id,
        delta: content,
      },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response },
    ])
    : Response.json(response);
}

function captureRequests(api: 'chat' | 'responses') {
  rstest.stubEnv(
    GENUI_MODEL_CONFIG_ENV,
    JSON.stringify({
      Fast: {
        apiKey: 'test-secret',
        baseURL,
        model,
        api,
        reasoningEffort: 'low',
      },
      Default: { apiKey: 'test-secret', baseURL, model, api },
    }),
  );
  const requests: Record<string, unknown>[] = [];
  rstest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    expect(url).toBe(
      `${baseURL}/${api === 'chat' ? 'chat/completions' : 'responses'}`,
    );
    const body = JSON.parse(
      typeof init?.body === 'string' ? init.body : '',
    ) as Record<string, unknown>;
    requests.push(body);
    return Promise.resolve(modelResponse(api, body.stream === true));
  });
  return requests;
}

for (const api of ['chat', 'responses'] as const) {
  test.each(services)(
    `%s sends configured effort through real Mastra ${api} generation and streaming`,
    async (name, create) => {
      const requests = captureRequests(api);
      const service = create();
      const log = rstest.fn();
      const options = {
        model: 'Fast',
        enableWebSearch: false,
        enableImageGeneration: false,
        onPerformanceEvent: log,
      };
      const generated = await service.generateRaw(messages, options);
      expect(generated.text).toBe(content);
      if ('streamAsAsyncIterable' in service) {
        const result = await service.streamAsAsyncIterable(messages, options);
        let streamed = '';
        for await (const chunk of result.textStream) streamed += chunk;
        expect(streamed).toBe(content);
        const finalized = await result.finalize();
        expect(finalized.text).toBe(content);
      }
      expect(requests).toHaveLength('streamAsAsyncIterable' in service ? 2 : 1);
      for (const body of requests) {
        expect(body.model).toBe(model);
        if (api === 'chat') {
          expect(body.reasoning_effort).toBe('low');
        } else {
          expect(body.reasoning).toEqual({ effort: 'low' });
        }
        const input = api === 'chat' ? body.messages : body.input;
        expect(input).toEqual(expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
        ]));
      }
      expect(log).toHaveBeenCalledWith(
        'agent.model.started',
        expect.objectContaining({ agent: name, reasoningEffort: 'low' }),
      );
    },
  );
}

test('cached agents keep reasoning overrides scoped to each invocation', async () => {
  const requests = captureRequests('responses');
  const service = new LynxXmlAgentService();
  const options = {
    model: 'Fast',
    enableWebSearch: false,
    enableImageGeneration: false,
    onPerformanceEvent: rstest.fn(),
  };
  for (
    const override of [
      {},
      { reasoningEffort: 'none' as const },
      { inheritReasoningEffort: false },
      {},
      { model: 'Default' },
    ]
  ) {
    await service.generateRaw(messages, { ...options, ...override });
  }
  expect(requests.map(body => body.reasoning)).toEqual([
    { effort: 'low' },
    { effort: 'none' },
    undefined,
    { effort: 'low' },
    undefined,
  ]);
});
