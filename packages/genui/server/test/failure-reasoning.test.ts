// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { expect, rstest, test } from '@rstest/core';

import { createResponsesCompatFetch } from '../agent/common/openai-responses-compat.js';
import { createFailureReasoning } from '../app/common/failure-reasoning.js';
import { createTextStreamRoute } from '../app/common/text-stream-route.js';
import { createAgentStepLogger } from '../service/common/agent-step-logger.js';
import {
  extractGenerationResult,
  toAsyncIterable,
} from '../service/common/result.js';

test('bounds request-local reasoning and redacts credentials split across chunks', () => {
  const reasoning = createFailureReasoning(['test-secret']);
  const other = createFailureReasoning([]);
  expect(reasoning.payload()).toEqual({});
  reasoning.append('Model returned test-');
  reasoning.append('secret');
  expect(reasoning.payload()).toEqual({
    reasoning: { text: 'Model returned [REDACTED]', truncated: false },
  });
  reasoning.append('x'.repeat(70_000));
  expect(reasoning.payload().reasoning?.text.length).toBeLessThanOrEqual(
    64_000,
  );
  expect(reasoning.payload().reasoning?.truncated).toBe(true);
  expect(other.payload()).toEqual({});
});

test.each(
  ['summary', 'text'].flatMap(format =>
    ['success', 'invalid', 'upstream', 'failed'].map(outcome => ({
      format,
      outcome,
    }))
  ),
)(
  'forwards real SDK reasoning only when generation fails (%s)',
  async ({ format, outcome }) => {
    const failure = outcome !== 'success';
    const reasoningText = 'Provider returned reasoning';
    const item = { type: 'reasoning', id: 'reasoning-1', summary: [] };
    const response = {
      id: 'response-1',
      created_at: 1,
      model: 'test-model',
      output: [],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 20 },
      },
      incomplete_details: { reason: 'max_output_tokens' },
    };
    const chunks = [
      { type: 'response.created', response },
      { type: 'response.output_item.added', output_index: 0, item },
      {
        type: format === 'text'
          ? 'response.reasoning_text.delta'
          : 'response.reasoning_summary_text.delta',
        item_id: item.id,
        summary_index: 0,
        content_index: 0,
        delta: 'Provider returned ',
      },
      {
        type: format === 'text'
          ? 'response.reasoning_text.delta'
          : 'response.reasoning_summary_text.delta',
        item_id: item.id,
        summary_index: 0,
        content_index: 0,
        delta: 'reasoning',
      },
      ...(outcome === 'upstream'
        ? [{
          type: 'error',
          sequence_number: 4,
          code: 'server_error',
          message: 'Upstream failed',
        }]
        : (outcome === 'failed'
          ? [{
            type: 'response.failed',
            sequence_number: 4,
            response: {
              ...response,
              incomplete_details: null,
              error: {
                code: 'invalid_request_error',
                message: 'Upstream input invalid',
              },
            },
          }]
          : [
            { type: 'response.output_item.done', output_index: 0, item },
            { type: 'response.incomplete', response },
          ])),
    ];
    const fetch = rstest.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(
          chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      )
    );
    const agent = new Agent({
      id: 'reasoning-test',
      name: 'Reasoning test',
      instructions: 'Return a greeting.',
      model: createOpenAI({
        apiKey: 'test-secret',
        fetch: createResponsesCompatFetch(fetch),
      }).responses(
        'test-model',
      ),
    });
    const log = rstest.spyOn(console, 'info').mockImplementation(() =>
      undefined
    );
    const details = rstest.spyOn(console, 'dir').mockImplementation(() =>
      undefined
    );
    try {
      const route = createTextStreamRoute({
        scope: 'reasoning-test',
        path: '/stream',
        getService: () => ({
          async streamAsAsyncIterable(_messages, opts) {
            const result = await agent.stream('Hello', {
              modelSettings: { maxRetries: 0 },
              ...createAgentStepLogger<unknown>(opts, 'test'),
            });
            return {
              textStream: toAsyncIterable(result.textStream),
              finalize: () => extractGenerationResult(result),
            };
          },
        }),
        normalizeFinalText: () => {
          if (failure) throw new Error('No artifact');
          return 'artifact';
        },
      });
      const result = await route.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.213',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Generate' }],
        }),
      });
      const body = await result.text();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(body).toContain(`event: ${failure ? 'error' : 'done'}`);
      if (failure) {
        expect(body).toContain(
          JSON.stringify({ text: reasoningText, truncated: false }),
        );
      } else expect(body).not.toContain(reasoningText);
      if (outcome === 'failed') {
        expect(body).toContain('Upstream input invalid');
        expect(body).toContain('"finishReason":"error"');
        expect(body).toContain('"statusCode":400');
      }
      expect(JSON.stringify(log.mock.calls)).not.toContain(reasoningText);
      expect(JSON.stringify(details.mock.calls)).not.toContain(reasoningText);
    } finally {
      log.mockRestore();
      details.mockRestore();
    }
  },
);

test('collects partial SDK chunks before errors without duplicating finished steps', () => {
  const reasoning = createFailureReasoning([]);
  const log = rstest.fn();
  const callbacks = createAgentStepLogger({
    onReasoning: reasoning.append,
    onPerformanceEvent: log,
  }, 'test');
  callbacks.onChunk(
    {
      type: 'reasoning-delta',
      payload: { id: 'r1', text: 'Partial reasoning' },
    } as never,
  );
  callbacks.onError({ error: new Error('Stream disconnected') });
  expect(reasoning.payload().reasoning?.text).toBe('Partial reasoning');
  callbacks.onStepFinish(
    {
      reasoningText: 'Partial reasoning',
      toolCalls: [],
      toolResults: [],
    } as never,
  );
  callbacks.onStepFinish(
    { reasoningText: 'Next step', toolCalls: [], toolResults: [] } as never,
  );
  expect(reasoning.payload().reasoning?.text).toBe(
    'Partial reasoning\n\nNext step',
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain('Partial reasoning');
});
