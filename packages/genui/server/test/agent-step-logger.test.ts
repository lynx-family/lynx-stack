// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { expect, rstest, test } from '@rstest/core';
import { z } from 'zod';

import { createAgentStepLogger } from '../service/common/agent-step-logger.js';

test('logs per-step usage and safe tool sizes with a matching aggregate', () => {
  const log = rstest.fn((_event: string, _details?: Record<string, unknown>) =>
    undefined
  );
  const callbacks = createAgentStepLogger({
    resourceId: 'genui-bench:run-1:attempt-2',
    onPerformanceEvent: log,
  }, 'test-agent');
  const xmlFragment = '<view id="secret-node"/>';
  const step = {
    runId: 'mastra-run',
    text: 'private output',
    reasoningText: 'private reasoning',
    request: {
      body: {
        messages: [{ role: 'system', content: 'private system' }],
        tools: [{ name: 'private-schema' }],
      },
    },
    response: { modelId: 'test-model' },
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedInputTokens: 90,
      cacheCreationInputTokens: 3,
      reasoningTokens: 2,
    },
    toolCalls: [{
      payload: {
        toolName: 'html_fragment_to_main_thread_script',
        toolCallId: 'tool-1',
        args: { xmlFragment },
      },
    }],
    toolResults: [{
      payload: {
        toolName: 'html_fragment_to_main_thread_script',
        toolCallId: 'tool-1',
        result: {
          bindings: { 'secret-node': 'node0' },
          placeholder: 'private placeholder',
        },
      },
    }],
    finishReason: 'tool-calls',
  };
  callbacks.onStepFinish(step as never);
  callbacks.onStepFinish(
    { ...step, toolCalls: [], toolResults: [], finishReason: 'stop' } as never,
  );
  callbacks.onFinish({
    runId: 'mastra-run',
    totalUsage: {
      inputTokens: 200,
      outputTokens: 40,
      totalTokens: 240,
      cachedInputTokens: 180,
      cacheCreationInputTokens: 6,
      reasoningTokens: 4,
    },
    finishReason: 'stop',
  } as never);
  expect(log).toHaveBeenNthCalledWith(
    2,
    'agent.model.step.completed',
    expect.objectContaining({
      step: 1,
      resourceId: 'genui-bench:run-1:attempt-2',
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        cachedTokens: 90,
        cacheWriteTokens: 3,
        reasoningTokens: 2,
      },
      toolCalls: [
        expect.objectContaining({
          argumentSizes: { xmlFragment: { chars: xmlFragment.length } },
        }),
      ],
      toolResults: [
        expect.objectContaining({
          status: 'success',
        }),
      ],
      messageCount: 1,
    }),
  );
  expect(log.mock.calls[1]![1]).toMatchObject({
    toolResults: [{ resultSizes: { bindings: { entries: 1 } } }],
  });
  const completed = log.mock.calls[3]![1]!;
  expect(completed.stepCount).toBe(2);
  expect(completed.stepUsageTotal).toEqual(completed.totalUsage);
  const serialized = JSON.stringify(log.mock.calls);
  expect(serialized).not.toContain('private');
  expect(serialized).not.toContain('secret-node');
});

test('retains missing usage as unknown, reads raw cache details, and separates invocations', () => {
  const log = rstest.fn((_event: string, _details?: Record<string, unknown>) =>
    undefined
  );
  const first = createAgentStepLogger(
    { onPerformanceEvent: log },
    'test-agent',
  );
  const second = createAgentStepLogger(
    { onPerformanceEvent: log },
    'test-agent',
  );
  const step = {
    text: '',
    toolCalls: [],
    toolResults: [{
      payload: {
        toolName: 'converter',
        toolCallId: 'failed',
        isError: true,
        result: { error: 'private error' },
      },
    }],
    usage: {
      raw: {
        inputTokens: { total: 30, cacheRead: 20, cacheWrite: 5 },
        outputTokens: { total: 4, reasoning: 1 },
      },
    },
  };
  first.onStepFinish(step as never);
  second.onStepFinish({ ...step, usage: {} } as never);
  expect(log.mock.calls[2]![1]).toMatchObject({
    step: 1,
    usage: {
      inputTokens: 30,
      outputTokens: 4,
      cachedTokens: 20,
      cacheWriteTokens: 5,
      reasoningTokens: 1,
    },
    toolResults: [expect.objectContaining({ status: 'error' })],
  });
  expect(log.mock.calls[3]![1]).toMatchObject({ step: 1, usage: {} });
  expect(log.mock.calls[2]![1]!.invocationId).not.toBe(
    log.mock.calls[3]![1]!.invocationId,
  );
  expect(log.mock.calls[3]![1]!.requestBodyChars).toBeUndefined();
  expect(log.mock.calls[2]![1]).toMatchObject({
    toolErrors: [{
      toolCallId: 'failed',
      error: { cause: { message: 'private error' } },
    }],
  });
});

test.each(['generate', 'stream'] as const)(
  'logs a real tool failure followed by successful retry through %s',
  async (mode) => {
    const log = rstest.fn((
      _event: string,
      _details?: Record<string, unknown>,
    ) => undefined);
    let calls = 0;
    const model = {
      specificationVersion: 'v2' as const,
      provider: 'diagnostic-test',
      modelId: 'diagnostic-test',
      supportedUrls: {},
      doGenerate: () => {
        const step = ++calls;
        return Promise.resolve({
          content: step < 3
            ? [{
              type: 'tool-call' as const,
              toolCallId: `call-${step}`,
              toolName: 'converter',
              input: JSON.stringify({ valid: step === 2 }),
            }]
            : [{ type: 'text' as const, text: 'done' }],
          finishReason: step < 3 ? 'tool-calls' as const : 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        });
      },
      doStream: () => {
        const step = ++calls;
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              if (step < 3) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: `call-${step}`,
                  toolName: 'converter',
                  input: JSON.stringify({ valid: step === 2 }),
                });
              } else {
                controller.enqueue({ type: 'text-start', id: 'answer' });
                controller.enqueue({
                  type: 'text-delta',
                  id: 'answer',
                  delta: 'done',
                });
                controller.enqueue({ type: 'text-end', id: 'answer' });
              }
              controller.enqueue({
                type: 'finish',
                finishReason: step < 3 ? 'tool-calls' : 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        });
      },
    };
    const agent = new Agent({
      id: 'failure-logger-test',
      name: 'Failure logger test',
      instructions: 'Test tool retries.',
      model,
      tools: {
        converter: createTool({
          id: 'converter',
          description: 'Convert input',
          inputSchema: z.object({ valid: z.boolean() }),
          execute: ({ valid }) => {
            if (!valid) throw new Error('Unsupported element: script');
            return Promise.resolve({ converted: true });
          },
        }),
      },
    });
    const options = {
      maxSteps: 3,
      ...createAgentStepLogger<unknown>(
        { onPerformanceEvent: log },
        'test-agent',
      ),
    };
    if (mode === 'generate') await agent.generate('Convert', options);
    else {
      const result = await agent.stream('Convert', options);
      await result.text;
    }
    const steps = log.mock.calls.filter(([event]) =>
      event === 'agent.model.step.completed'
    ).map(([, details]) => details!);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({
      toolResults: [],
      toolErrors: [{
        toolCallId: 'call-1',
        toolName: 'converter',
      }],
    });
    const errors = steps[0]!.toolErrors as { error: { message: string } }[];
    expect(errors[0]!.error.message).toContain('Unsupported element: script');
    expect(steps[1]).toMatchObject({
      toolErrors: [],
      toolResults: [{ toolCallId: 'call-2', status: 'success' }],
    });
    expect(steps[2]).toMatchObject({ toolErrors: [], finishReason: 'stop' });
  },
);

test('redacts credentials and schema input dumps from tool errors', () => {
  const log = rstest.fn((_event: string, _details?: Record<string, unknown>) =>
    undefined
  );
  const callbacks = createAgentStepLogger({
    apiKey: 'test-secret-key',
    onPerformanceEvent: log,
  }, 'test-agent');
  callbacks.onStepFinish({
    usage: {},
    toolCalls: [],
    toolResults: [],
    content: [{
      type: 'tool-error',
      toolCallId: 'invalid',
      toolName: 'converter',
      error: new Error(
        'Invalid arguments. Value: {"source":"private source"}. Error message: expected string; test-secret-key',
      ),
    }],
  } as never);
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('expected string');
  expect(output).not.toContain('private source');
  expect(output).not.toContain('test-secret-key');
});
