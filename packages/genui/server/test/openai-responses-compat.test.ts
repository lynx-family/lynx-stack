// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import { createLLMProvider } from '../agent/common/openai-provider.js';
import { createResponsesCompatFetch } from '../agent/common/openai-responses-compat.js';
import { resolveBenchCatalog } from '../service/a2ui/a2ui-bench-catalog.js';
import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import { runBenchJob } from '../service/common/bench/runner.js';
import { getBenchJobStore } from '../service/common/bench/store.js';
import type { BenchJobRequest } from '../service/common/bench/types.js';
import { readBenchTokenUsage } from '../service/common/bench/usage.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import { createHtmlBenchAdapter } from '../service/html/html-bench-adapter.js';
import { createLynxXmlBenchAdapter } from '../service/lynx-xml/lynx-xml-bench-adapter.js';

const endpoint = 'https://compatible-provider.example/v1';
const input: ProtocolBenchAdapterInput = {
  runId: 'compat-run',
  pairId: 'compat-pair',
  scenario: {
    id: 'greeting',
    name: 'Greeting',
    prompt: 'Show Hello',
    type: 'Information',
    complexity: 1,
  },
  repeatIndex: 1,
  maxAttempts: 4,
  provider: { model: 'Compatible' },
};

function responseBody(text: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'response-1',
    object: 'response',
    created_at: 1,
    model: 'opaque-model',
    status: 'completed',
    output: [{
      type: 'reasoning',
      id: 'reasoning-1',
      summary: [{ type: 'summary_text', text: 'Preparing a greeting.' }],
    }, {
      type: 'message',
      id: 'message-1',
      role: 'assistant',
      content: [{ type: 'output_text', text, ...extra }],
    }] as const,
    usage: {
      input_tokens: 10,
      output_tokens: 8,
      total_tokens: 18,
      input_tokens_details: { cached_tokens: 2 },
      output_tokens_details: { reasoning_tokens: 3 },
    },
  };
}

function configureProvider(baseURL = endpoint) {
  rstest.stubEnv(
    GENUI_MODEL_CONFIG_ENV,
    JSON.stringify({
      Compatible: {
        model: 'opaque-model',
        apiKey: 'test-secret',
        baseURL,
        api: 'responses',
        reasoningEffort: 'low',
      },
    }),
  );
  rstest.spyOn(console, 'info').mockImplementation(() => undefined);
  rstest.spyOn(console, 'error').mockImplementation(() => undefined);
}

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each(
  [
    [
      'Lynx XML',
      createLynxXmlBenchAdapter,
      '<!doctype lynx><lynx engine-version="4.2"><script thread="main"></script></lynx>',
    ],
    [
      'HTML',
      createHtmlBenchAdapter,
      '<!doctype html><html><head></head><body>Hello</body></html>',
    ],
  ] as const,
)(
  'accepts omitted annotations through real %s Bench, Mastra, and Responses SDK generation',
  async (_name, create, source) => {
    configureProvider();
    const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) => {
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as Record<string, unknown>;
        expect(body.model).toBe('opaque-model');
        expect(body.reasoning).toEqual({ effort: 'low' });
        return Promise.resolve(Response.json(responseBody(source)));
      },
    );
    const result = await create().generate(input);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.finalErrors).toEqual([]);
    expect(result.finalValid).toBe(true);
    expect(result.finalText).toBe(source);
    expect(result.attempts).toHaveLength(1);
    expect(readBenchTokenUsage(result.attempts[0]?.usage)).toMatchObject({
      inputTokens: 10,
      outputTokens: 8,
      totalTokens: 18,
      cachedTokens: 2,
      reasoningTokens: 3,
    });
  },
);

test.each(['native', 'matched-core'] as const)(
  'repairs invalid %s A2UI through real Bench, Mastra, and Responses requests requiring assistant type and status',
  async (profile) => {
    configureProvider();
    const catalogId = resolveBenchCatalog('Full Catalog').id
      + (profile === 'matched-core' ? '#matched-core' : '');
    const source = JSON.stringify([
      { version: 'v0.9', createSurface: { surfaceId: 'main', catalogId } },
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
    ]);
    const conversations: Record<string, unknown>[][] = [];
    const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) => {
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as {
          input: Record<string, unknown>[];
          model: string;
          reasoning: unknown;
        };
        expect(body.model).toBe('opaque-model');
        expect(body.reasoning).toEqual({ effort: 'low' });
        conversations.push(body.input);
        const missingField = ['type', 'status'].find(field =>
          body.input.some(item =>
            item.role === 'assistant' && item[field] === undefined
          )
        );
        if (missingField) {
          return Promise.resolve(Response.json({
            error: {
              message:
                `The request failed because it is missing \`input.${missingField}\` parameter.`,
              type: 'invalid_request_error',
            },
          }, { status: 400 }));
        }
        return Promise.resolve(Response.json(
          responseBody(conversations.length === 1 ? 'invalid' : source),
        ));
      },
    );
    const request: BenchJobRequest = {
      groups: [{
        id: 'compat-group',
        name: 'Compatible group',
        enabled: true,
        role: 'control',
        variable: 'custom',
        model: 'Compatible',
        protocol: 'a2ui',
        profile,
      }],
      provider: {},
      scenarios: [input.scenario],
      settings: {
        judgeEnabled: false,
        renderMetricsEnabled: false,
        repairEnabled: true,
        maxRepairAttempts: 1,
        repeats: 1,
      },
    };
    const job = getBenchJobStore().createJob(request, 1);
    await runBenchJob(job.id);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(conversations[0]?.some(item => item.role === 'assistant')).toBe(
      false,
    );
    expect(conversations[1]?.filter(item => item.role === 'assistant')).toEqual(
      [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'invalid' }],
        },
      ],
    );
    expect(job.report?.results[0]).toMatchObject({
      ok: true,
      attempts: 2,
      tokens: 36,
      errors: [],
      protocol: 'a2ui',
      profile,
    });
    expect(JSON.parse(job.report!.results[0]!.text!)).toEqual(
      JSON.parse(source),
    );
  },
);

test.each([false, true])(
  'fills absent historical assistant types and statuses independently and preserves request options (stream: %s)',
  async (stream) => {
    const assistant = {
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Previous answer' }],
    };
    const payload = {
      model: 'opaque-model',
      stream,
      input: [
        assistant,
        {
          ...assistant,
          type: 'message',
          id: 'message-1',
          phase: 'final_answer',
        },
        {
          role: 'assistant',
          type: 'message',
          content: [{ type: 'refusal', refusal: 'Unavailable' }],
        },
        ...['completed', 'in_progress', 'incomplete', null, 'invalid'].map(
          status => ({ ...assistant, status }),
        ),
        { ...assistant, partial: true },
        { ...assistant, type: 'unknown' },
        { ...assistant, type: null },
        { ...assistant, content: [] },
        { ...assistant, content: [null] },
        { ...assistant, content: 'Plain assistant input' },
        { ...assistant, content: [{ type: 'input_text', text: 'Input' }] },
        { role: 'user', content: [{ type: 'input_text', text: 'Continue' }] },
        { role: 'system', content: 'System instructions' },
        { type: 'reasoning', id: 'reasoning-1', summary: [] },
        {
          type: 'function_call',
          call_id: 'call-1',
          name: 'lookup',
          arguments: '{}',
        },
        { type: 'function_call_output', call_id: 'call-1', output: 'Result' },
        { type: 'item_reference', id: 'message-2' },
        null,
      ],
    };
    const expected = structuredClone(payload);
    for (const item of expected.input.slice(0, 3)) {
      Object.assign(item!, { type: 'message', status: 'completed' });
    }
    for (const item of expected.input.slice(3, 9)) {
      Object.assign(item!, { type: 'message' });
    }
    const body = JSON.stringify(payload);
    const controller = new AbortController();
    const options = {
      method: 'POST',
      body,
      signal: controller.signal,
      redirect: 'error',
      headers: new Headers({
        authorization: 'Bearer test-secret',
        'content-type': 'application/json',
        'content-length': String(body.length),
      }),
    } satisfies RequestInit;
    const response = stream
      ? new Response('data: [DONE]\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      })
      : new Response(null, { status: 204 });
    const fetch = rstest.fn(
      (_url: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
        expect(init?.body).toBe(JSON.stringify(expected));
        expect(init?.method).toBe('POST');
        expect(init?.signal).toBe(controller.signal);
        expect(init?.redirect).toBe('error');
        const headers = new Headers(init?.headers);
        expect(headers.get('authorization')).toBe('Bearer test-secret');
        expect(headers.get('content-type')).toBe('application/json');
        expect(headers.has('content-length')).toBe(false);
        return Promise.resolve(response);
      },
    );
    const result = await createResponsesCompatFetch(fetch)(endpoint, options);
    expect(fetch).toHaveBeenCalledTimes(1);
    if (!stream) expect(result).toBe(response);
    expect(result.bodyUsed).toBe(false);
    expect(options.body).toBe(body);
    expect(options.headers.get('content-length')).toBe(String(body.length));
    await result.body?.cancel();
  },
);

test.each([
  undefined,
  new Uint8Array([1, 2, 3]),
  '{ invalid JSON',
  'null',
  '{"input":"Hello"}',
  '{"input":[{"type":"message","role":"assistant","status":"incomplete","content":[{"type":"output_text","text":"Partial"}]}]}',
])(
  'leaves unrelated or unmodified request bodies untouched: %s',
  async (body) => {
    const options: RequestInit = body === undefined ? {} : { body };
    const fetch = rstest.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    );
    await createResponsesCompatFetch(fetch)(endpoint, options);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]).toBe(options);
  },
);

test('leaves official OpenAI assistant inputs unchanged', async () => {
  configureProvider('https://api.openai.com/v1');
  const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
    (_url, init) => {
      const body = JSON.parse(init!.body as string) as {
        input: Record<string, unknown>[];
      };
      expect(body.input.find(item => item.role === 'assistant')).toEqual({
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Previous answer' }],
      });
      return Promise.resolve(
        Response.json(responseBody('Hello', { annotations: [] })),
      );
    },
  );
  const { provider, model } = createLLMProvider({ model: 'Compatible' });
  await provider.responses(model).doGenerate({
    prompt: [
      { role: 'user', content: [{ type: 'text', text: 'Show Hello' }] },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Previous answer' }],
      },
      { role: 'user', content: [{ type: 'text', text: 'Continue' }] },
    ],
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('fills only absent text annotations while retaining citations, reasoning, tools, and usage', async () => {
  const payload = {
    ...responseBody('Hello'),
    output: [
      ...responseBody('Hello').output,
      {
        type: 'function_call',
        id: 'tool-1',
        call_id: 'call-1',
        name: 'lookup',
        arguments: '{}',
      },
      {
        type: 'message',
        id: 'message-2',
        role: 'assistant',
        content: [
          { type: 'output_text', text: ' World' },
          {
            type: 'output_text',
            text: 'Reference',
            annotations: [{
              type: 'url_citation',
              url: 'https://example.com/reference',
              title: 'Reference',
              start_index: 0,
              end_index: 9,
            }],
          },
          { type: 'refusal', refusal: 'Unavailable' },
        ],
      },
    ] as const,
  };
  const expected = structuredClone(payload);
  Object.assign(expected.output[1].content[0], { annotations: [] });
  Object.assign(expected.output[3].content[0], { annotations: [] });
  const response = Response.json(payload, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': '123',
      'x-request-id': 'request-1',
    },
  });
  const fetch = rstest.fn(() => Promise.resolve(response));
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const result = await createResponsesCompatFetch(fetch)(endpoint, options);
  expect(fetch).toHaveBeenCalledWith(endpoint, options);
  expect(result.status).toBe(200);
  expect(result.headers.get('x-request-id')).toBe('request-1');
  expect(result.headers.get('content-type')).toBe(
    'application/json; charset=utf-8',
  );
  expect(result.headers.has('content-length')).toBe(false);
  expect(result.headers.has('content-encoding')).toBe(false);
  expect(await result.json()).toEqual(expected);
});

test.each(
  [
    ['HTTP errors', 429, 'application/json'],
    ['non-JSON replies', 200, 'text/plain'],
  ] as const,
)(
  'passes %s through without reading its stream',
  async (_name, status, contentType) => {
    const response = new Response('unread body', {
      status,
      headers: { 'Content-Type': contentType, 'Retry-After': '3' },
    });
    const result = await createResponsesCompatFetch(() =>
      Promise.resolve(response)
    )(endpoint);
    expect(result).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect(result.headers.get('Retry-After')).toBe('3');
    await result.body?.cancel();
  },
);

test.each([
  '{ invalid JSON',
  'null',
  '{"output":[null,{"type":"message","content":null}]}',
  JSON.stringify(responseBody('Hello', { annotations: [] })),
  JSON.stringify(responseBody('Hello', { annotations: null })),
  JSON.stringify(responseBody('Hello', { annotations: {} })),
])(
  'preserves unmodified or malformed JSON for SDK validation: %s',
  async (body) => {
    const response = new Response(body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await createResponsesCompatFetch(() =>
      Promise.resolve(response)
    )(endpoint);
    expect(await result.text()).toBe(body);
  },
);

test('propagates interrupted response bodies instead of masking them as schema failures', async () => {
  const error = new DOMException('Cancelled', 'AbortError');
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  await expect(
    createResponsesCompatFetch(() => Promise.resolve(response))(endpoint),
  )
    .rejects.toBe(error);
});

test.each(
  [
    ['official OpenAI', 'https://api.openai.com/v1', {}],
    ['explicit invalid annotations', endpoint, { annotations: null }],
  ] as const,
)('retains SDK validation for %s', async (_name, baseURL, extra) => {
  configureProvider(baseURL);
  rstest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(Response.json(responseBody('Hello', extra)))
  );
  const { provider, model } = createLLMProvider({ model: 'Compatible' });
  await expect(
    provider.responses(model).doGenerate({
      prompt: [{
        role: 'user',
        content: [{ type: 'text', text: 'Show Hello' }],
      }],
    }),
  ).rejects.toMatchObject({
    name: 'AI_APICallError',
    statusCode: 200,
    isRetryable: false,
  });
});

test('retains redirect restrictions and cancellation on custom Responses providers', async () => {
  const controller = new AbortController();
  const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
    (_url, init) => {
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBe(controller.signal);
      const body = JSON.parse(init!.body as string) as {
        input: Record<string, unknown>[];
      };
      expect(body.input.find(item => item.role === 'assistant')).toMatchObject({
        type: 'message',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Previous answer' }],
      });
      return Promise.resolve(Response.json(responseBody('Hello')));
    },
  );
  const { provider, model } = createLLMProvider({
    model: 'custom-model',
    apiKey: 'test-secret',
    baseURL: 'https://openrouter.ai/api/v1',
    api: 'responses',
  });
  const result = await provider.responses(model).doGenerate({
    prompt: [
      { role: 'user', content: [{ type: 'text', text: 'Show Hello' }] },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Previous answer' }],
      },
      { role: 'user', content: [{ type: 'text', text: 'Continue' }] },
    ],
    abortSignal: controller.signal,
  });
  expect(result.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'text', text: 'Hello' }),
  ]));
  expect(fetch).toHaveBeenCalledTimes(1);
});
