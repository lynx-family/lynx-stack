// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenAI } from '@ai-sdk/openai';
import { expect, rstest, test } from '@rstest/core';

import { createResponsesCompatFetch } from '../agent/common/openai-responses-compat.js';

const endpoint = 'https://compatible-provider.example/v1';
const item = { type: 'reasoning', id: 'reasoning-1', summary: [] };
const response = {
  id: 'response-1',
  created_at: 1,
  model: 'test-model',
  status: 'completed',
  output: [],
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 18 },
  },
};

function raw(type: string, fields: Record<string, unknown> = {}) {
  return {
    type,
    item_id: item.id,
    output_index: 0,
    content_index: 3,
    ...fields,
  };
}

function sse(events: unknown[], eol = '\n') {
  return events.map(event => `data: ${JSON.stringify(event)}${eol}${eol}`).join(
    '',
  );
}

function modelWithResponse(body: BodyInit) {
  return createOpenAI({
    apiKey: 'test-secret',
    fetch: createResponsesCompatFetch(() =>
      Promise.resolve(
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' },
        }),
      )
    ),
  }).responses('test-model');
}

const prompt = [{
  role: 'user' as const,
  content: [{ type: 'text' as const, text: 'Hello' }],
}];

test.each(['\n', '\r\n', '\r'])(
  'streams reasoning and answers through the real SDK across byte boundaries (%j)',
  async eol => {
    const first = '先分析🙂';
    const second = '再生成界面';
    const part = { type: 'reasoning_text', text: first };
    const message = { type: 'message', id: 'message-1', role: 'assistant' };
    const wire = sse([
      { type: 'response.created', response },
      { type: 'response.output_item.added', output_index: 0, item },
      raw('response.content_part.added', { part: { ...part, text: '' } }),
      raw('response.reasoning_text.delta', { delta: first }),
      raw('response.reasoning_text.done', { text: first }),
      raw('response.content_part.done', { part }),
      raw('response.reasoning_text.done', { text: first }),
      // A second representation of this same item must not duplicate its text.
      raw('response.reasoning_summary_text.delta', {
        summary_index: 0,
        delta: first,
      }),
      raw('response.content_part.added', {
        content_index: 7,
        part: { ...part, text: '' },
      }),
      raw('response.reasoning_text.delta', { content_index: 7, delta: second }),
      raw('response.reasoning_text.done', { content_index: 7, text: second }),
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.output_item.added', output_index: 1, item: message },
      {
        type: 'response.output_text.delta',
        item_id: message.id,
        output_index: 1,
        content_index: 0,
        delta: 'Hello',
      },
      { type: 'response.output_item.done', output_index: 1, item: message },
      { type: 'response.completed', response },
    ], eol);
    const bytes = new TextEncoder().encode(wire);
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) controller.close();
        else controller.enqueue(bytes.slice(offset, ++offset));
      },
    });
    const result = await modelWithResponse(body).doStream({
      prompt: [...prompt],
    });
    const chunks = await Array.fromAsync(result.stream);
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
    expect(
      chunks.filter(chunk => chunk.type === 'reasoning-delta').map(chunk =>
        chunk.delta
      ),
    ).toEqual([first, second]);
    expect(
      chunks.filter(chunk => chunk.type === 'reasoning-start').map(chunk =>
        chunk.id
      ),
    ).toEqual(['reasoning-1:0', 'reasoning-1:1']);
    expect(
      chunks.filter(chunk => chunk.type === 'reasoning-end').map(chunk =>
        chunk.id
      ),
    ).toEqual(['reasoning-1:0', 'reasoning-1:1']);
    expect(
      chunks.filter(chunk => chunk.type === 'text-delta').map(chunk =>
        chunk.delta
      ),
    ).toEqual(['Hello']);
    expect(chunks.at(-1)).toMatchObject({
      type: 'finish',
      usage: { outputTokens: { total: 20, reasoning: 18 } },
    });
  },
);

test('uses done text only when deltas are absent and leaves native summaries intact', async () => {
  const other = { ...item, id: 'reasoning-2' };
  const result = await modelWithResponse(sse([
    { type: 'response.created', response },
    { type: 'response.output_item.added', output_index: 0, item },
    raw('response.reasoning_text.done', { text: 'Done only' }),
    raw('response.content_part.done', {
      part: { type: 'reasoning_text', text: 'Done only' },
    }),
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.output_item.added', output_index: 1, item: other },
    raw('response.reasoning_summary_text.delta', {
      item_id: other.id,
      output_index: 1,
      summary_index: 0,
      delta: 'Native summary',
    }),
    raw('response.reasoning_text.delta', {
      item_id: other.id,
      output_index: 1,
      delta: 'Duplicate raw text',
    }),
    { type: 'response.output_item.done', output_index: 1, item: other },
    { type: 'response.completed', response },
  ])).doStream({ prompt: [...prompt] });
  const chunks = await Array.fromAsync(result.stream);
  expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
  expect(
    chunks.filter(chunk => chunk.type === 'reasoning-delta').map(chunk =>
      chunk.delta
    ),
  ).toEqual(['Done only', 'Native summary']);
});

test('preserves unrelated frames, malformed data, and incomplete trailing frames', async () => {
  const wire =
    ': heartbeat\r\n\r\nevent: unknown\r\ndata: {"custom":true}\r\n\r\ndata: [DONE]\n\ndata: {broken}\n\ndata: {"type":"response.reasoning_text.delta"';
  const result = await createResponsesCompatFetch(() =>
    Promise.resolve(
      new Response(wire, {
        headers: { 'content-type': 'text/event-stream' },
      }),
    )
  )(endpoint);
  expect(await result.text()).toBe(wire.replace(/\r\n/gu, '\n'));
});

test('preserves failed upstream usage and errors through the SDK', async () => {
  const result = await modelWithResponse(sse([
    { type: 'response.created', response },
    { type: 'response.output_item.added', output_index: 0, item },
    raw('response.reasoning_text.delta', { delta: 'Partial reasoning' }),
    {
      type: 'response.failed',
      sequence_number: 3,
      response: {
        ...response,
        error: {
          code: 'invalid_request_error',
          message: 'Upstream input invalid',
        },
      },
    },
  ])).doStream({ prompt });
  const chunks = await Array.fromAsync(result.stream);
  expect(
    chunks.filter(chunk => chunk.type === 'reasoning-delta').map(chunk =>
      chunk.delta
    ),
  ).toEqual(['Partial reasoning']);
  expect(chunks.find(chunk => chunk.type === 'error')).toMatchObject({
    error: { message: 'Upstream input invalid', statusCode: 400 },
  });
  expect(chunks.at(-1)).toMatchObject({
    type: 'finish',
    finishReason: { unified: 'error' },
    usage: { outputTokens: { total: 20, reasoning: 18 } },
  });
});

test('handles multiline data and retains SSE ids and response diagnostics', async () => {
  const event = raw('response.reasoning_text.delta', { delta: '思考' });
  const wire = `id: event-1\nevent: response.reasoning_text.delta\n${
    JSON.stringify(event, null, 2).split('\n').map(line => `data: ${line}`)
      .join('\n')
  }\n\n`;
  const result = await createResponsesCompatFetch(() =>
    Promise.resolve(
      new Response(wire, {
        headers: {
          'content-type': 'text/event-stream',
          'content-length': '100',
          'content-encoding': 'gzip',
          'x-request-id': 'ark-request-1',
        },
      }),
    )
  )(endpoint);
  expect(result.status).toBe(200);
  expect(result.headers.get('x-request-id')).toBe('ark-request-1');
  expect(result.headers.has('content-length')).toBe(false);
  expect(result.headers.has('content-encoding')).toBe(false);
  const text = await result.text();
  expect(text).toContain('id: event-1');
  expect(text).toContain('event: response.reasoning_summary_text.delta');
  expect(text).toContain('"delta":"思考"');
});

test.each(['cancel', 'error'])(
  'delivers partial reasoning before upstream completion and propagates %s',
  async ending => {
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = rstest.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        upstream = controller;
      },
      cancel,
    });
    const result = await createResponsesCompatFetch(() =>
      Promise.resolve(
        new Response(source, {
          headers: { 'content-type': 'text/event-stream' },
        }),
      )
    )(endpoint);
    const reader = result.body!.getReader();
    upstream.enqueue(
      new TextEncoder().encode(
        sse([raw('response.reasoning_text.delta', { delta: 'Partial' })]),
      ),
    );
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain(
      '"delta":"Partial"',
    );
    const error = new DOMException('Disconnected', 'AbortError');
    if (ending === 'cancel') {
      await reader.cancel(error);
      await rstest.waitFor(() => expect(cancel).toHaveBeenCalledWith(error));
    } else {
      upstream.error(error);
      await expect(reader.read()).rejects.toBe(error);
    }
  },
);

test.each([undefined, [], [{
  type: 'summary_text',
  text: 'Existing summary',
}]])(
  'normalizes plain reasoning in JSON without duplicating an existing summary (%j)',
  async summary => {
    const value = {
      ...response,
      output: [{
        ...item,
        summary,
        content: [{ type: 'reasoning_text', text: 'Returned reasoning' }],
      }],
    };
    const model = createOpenAI({
      apiKey: 'test-secret',
      fetch: createResponsesCompatFetch(() =>
        Promise.resolve(Response.json(value))
      ),
    }).responses('test-model');
    const result = await model.doGenerate({ prompt: [...prompt] });
    expect(
      result.content.filter(part => part.type === 'reasoning').map(part =>
        part.text
      ),
    ).toEqual([
      summary && summary.length > 0 ? 'Existing summary' : 'Returned reasoning',
    ]);
  },
);
