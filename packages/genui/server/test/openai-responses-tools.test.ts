// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import { createLLMProvider } from '../agent/common/openai-provider.js';
import { createResponsesCompatFetch } from '../agent/common/openai-responses-compat.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import { getReactLynxAgentService } from '../service/reactlynx/reactlynx-agent.js';
import { getReactWebAgentService } from '../service/reactweb/reactweb-agent.js';

const endpoint = 'https://compatible-provider.example/v1';
const tool = {
  call_id: 'call_00_ow5vucqnfisl49qw8cgqzho4',
  name: 'generate_image',
  type: 'function_call',
  id: 'fc_02179161691224200000000000000000000ffffac190396833193',
  status: 'in_progress',
};
const added = {
  type: 'response.output_item.added',
  output_index: 1,
  item: tool,
  sequence_number: 23,
};
const response = {
  id: 'response-1',
  created_at: 1,
  model: 'test-model',
  status: 'completed',
  output: [],
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 5 },
  },
};
const prompt = [{
  role: 'user' as const,
  content: [{ type: 'text' as const, text: 'Generate an image' }],
}];

function sse(events: unknown[], eol = '\n') {
  return new Response(
    events.map(event => `data: ${JSON.stringify(event)}${eol}${eol}`).join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function toolEvents(start = added, args = '{"prompt":"风景🙂"}') {
  return [
    { type: 'response.created', response },
    start,
    ...[args.slice(0, 10), args.slice(10)].map(delta => ({
      type: 'response.function_call_arguments.delta',
      item_id: tool.id,
      output_index: 1,
      delta,
    })),
    {
      type: 'response.function_call_arguments.done',
      item_id: tool.id,
      output_index: 1,
      arguments: args,
    },
    {
      type: 'response.output_item.done',
      output_index: 1,
      item: { ...tool, status: 'completed', arguments: args },
    },
    { type: 'response.completed', response },
  ];
}

function configureProvider(baseURL = endpoint) {
  rstest.stubEnv(
    GENUI_MODEL_CONFIG_ENV,
    JSON.stringify({
      Compatible: {
        model: 'test-model',
        apiKey: 'test-secret',
        baseURL,
        api: 'responses',
      },
    }),
  );
}

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each(['\n', '\r\n', '\r'])(
  'accepts missing tool start arguments through the real SDK across byte boundaries (%j)',
  async eol => {
    configureProvider();
    const bytes = new Uint8Array(await sse(toolEvents(), eol).arrayBuffer());
    let offset = 0;
    rstest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (offset === bytes.length) controller.close();
              else controller.enqueue(bytes.slice(offset, ++offset));
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      )
    );
    const { provider, model } = createLLMProvider({ model: 'Compatible' });
    const result = await provider.responses(model).doStream({ prompt });
    const chunks = await Array.fromAsync(result.stream);
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
    expect(chunks.filter(chunk => chunk.type === 'tool-input-start')).toEqual([
      { type: 'tool-input-start', id: tool.call_id, toolName: tool.name },
    ]);
    expect(
      chunks.filter(chunk => chunk.type === 'tool-input-delta')
        .map(chunk => chunk.delta).join(''),
    ).toBe('{"prompt":"风景🙂"}');
    expect(chunks.filter(chunk => chunk.type === 'tool-call')).toEqual([
      expect.objectContaining({
        toolCallId: tool.call_id,
        toolName: tool.name,
        input: '{"prompt":"风景🙂"}',
      }),
    ]);
    expect(chunks.at(-1)).toMatchObject({
      type: 'finish',
      finishReason: { unified: 'tool-calls' },
      usage: { outputTokens: { total: 20, reasoning: 5 } },
    });
  },
);

test.each(['reactweb', 'reactlynx'] as const)(
  'runs %s image generation and resumes the real Mastra Responses stream',
  async protocol => {
    configureProvider();
    rstest.stubEnv('IMG_GEN_ARK_API_KEY', 'image-secret');
    rstest.stubEnv('IMG_GEN_ARK_IMAGE_MODEL', 'image-model');
    rstest.stubEnv(
      'IMG_GEN_ARK_IMAGE_BASE_URL',
      'https://images.example.com/v3',
    );
    rstest.spyOn(console, 'info').mockImplementation(() => undefined);
    rstest.spyOn(console, 'error').mockImplementation(() => undefined);
    const imageUrl = 'https://images.example.com/generated.png';
    const args = JSON.stringify({ prompt: '风景🙂' });
    const source = JSON.stringify({
      files: {
        'App.tsx': 'export default () => <text>Hello</text>;',
        'App.css': '',
      },
    });
    let modelCalls = 0;
    let imageCalls = 0;
    rstest.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const requestUrl = url instanceof Request ? url.url : url.toString();
      const body = JSON.parse(init!.body as string) as {
        input: unknown[];
        prompt?: string;
      };
      if (requestUrl === 'https://images.example.com/v3/images/generations') {
        imageCalls++;
        expect(body.prompt).toBe('风景🙂');
        return Promise.resolve(Response.json({ data: [{ url: imageUrl }] }));
      }
      expect(requestUrl).toBe(`${endpoint}/responses`);
      modelCalls++;
      if (modelCalls === 1) {
        return Promise.resolve(sse(toolEvents(added, args)));
      }
      expect(modelCalls).toBe(2);
      expect(body.input).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call',
          call_id: tool.call_id,
          name: tool.name,
          arguments: args,
        }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: tool.call_id,
          output: expect.stringContaining(imageUrl) as unknown,
        }),
      ]));
      const item = { type: 'message', id: 'message-1', role: 'assistant' };
      return Promise.resolve(sse([
        { type: 'response.created', response },
        { type: 'response.output_item.added', output_index: 0, item },
        {
          type: 'response.output_text.delta',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          delta: source,
        },
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response },
      ]));
    });
    const service = protocol === 'reactweb'
      ? getReactWebAgentService()
      : getReactLynxAgentService();
    const result = await service.streamAsAsyncIterable(
      [{ role: 'user', content: 'Generate an image page' }],
      { model: 'Compatible', disableAgentCache: true, enableWebSearch: false },
    );
    const deltas = await Array.fromAsync(result.textStream);
    expect(deltas.join('')).toBe(source);
    const final = await result.finalize();
    expect(final.text).toBe(source);
    expect(final.finishReason).toBe('stop');
    expect(modelCalls).toBe(2);
    expect(imageCalls).toBe(1);
  },
);

test.each([
  { ...added, item: { ...tool, arguments: null } },
  { ...added, item: { ...tool, arguments: {} } },
  { ...added, item: { ...tool, arguments: '{"prompt":"existing"}' } },
  { ...added, item: { ...tool, type: 'message' } },
  { ...added, type: 'response.output_item.done' },
  { ...added, type: 'response.function_call_arguments.done' },
])('preserves explicit arguments and non-start events (%j)', async event => {
  const original = sse([event]);
  const wire = await original.clone().text();
  const result = await createResponsesCompatFetch(() =>
    Promise.resolve(original)
  )(
    endpoint,
  );
  expect(await result.text()).toBe(wire);
});

test('keeps official OpenAI start events subject to SDK validation', async () => {
  configureProvider('https://api.openai.com/v1');
  rstest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(sse([
      { type: 'response.created', response },
      added,
      { type: 'response.completed', response },
    ]))
  );
  const { provider, model } = createLLMProvider({ model: 'Compatible' });
  const result = await provider.responses(model).doStream({ prompt });
  const chunks = await Array.fromAsync(result.stream);
  expect(chunks.find(chunk => chunk.type === 'error')).toMatchObject({
    error: { name: 'AI_TypeValidationError' },
  });
});
