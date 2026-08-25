// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { describe, expect, test } from '@rstest/core';
import { z } from 'zod';

import { getA2UIMastra } from '../agent/a2ui-mastra.js';

const usage = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
};

function readableStream<T>(chunks: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('A2UI Mastra runtime', () => {
  test('resumes a real suspended Agent run from process memory', async () => {
    let modelCall = 0;
    const model = {
      specificationVersion: 'v2' as const,
      provider: 'a2ui-test',
      modelId: 'suspend-resume-test',
      supportedUrls: {},
      doGenerate: () => Promise.reject(new Error('generate is not used')),
      doStream: () => {
        modelCall += 1;
        if (modelCall === 1) {
          return Promise.resolve({
            stream: readableStream([
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'tool-call' as const,
                toolCallId: 'deferred-call-1',
                toolName: 'deferred_result',
                input: '{}',
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage,
              },
            ]),
          });
        }
        return Promise.resolve({
          stream: readableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'text-start' as const, id: 'resumed-text' },
            {
              type: 'text-delta' as const,
              id: 'resumed-text',
              delta: 'continued after resume',
            },
            { type: 'text-end' as const, id: 'resumed-text' },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage,
            },
          ]),
        });
      },
    };
    const deferredResult = createTool({
      id: 'deferred_result',
      description: 'Suspend once, then return the supplied result.',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      suspendSchema: z.object({ pending: z.literal(true) }),
      resumeSchema: z.object({ value: z.string() }),
      execute: async (_input, context) => {
        if (context.agent?.resumeData !== undefined) {
          return z.object({ value: z.string() }).parse(
            context.agent.resumeData,
          );
        }
        await context.agent?.suspend({ pending: true });
      },
    });
    const mastra = getA2UIMastra();
    const agent = new Agent({
      id: `a2ui-suspend-test-${crypto.randomUUID()}`,
      name: 'A2UI suspend test',
      instructions: 'Use the deferred result tool.',
      mastra,
      model,
      tools: { deferred_result: deferredResult },
      defaultOptions: { maxSteps: 3 },
    });

    expect(getA2UIMastra()).toBe(mastra);

    const initial = await agent.stream('start');
    await initial.consumeStream();
    expect(await initial.finishReason).toBe('suspended');
    expect(initial.runId).toBeTruthy();

    const suspension = await initial.suspendPayload as {
      suspendPayload: { pending: true };
      toolCallId: string;
      toolName: string;
    };
    expect(suspension).toMatchObject({
      suspendPayload: { pending: true },
      toolCallId: 'deferred-call-1',
      toolName: 'deferred_result',
    });

    const resumed = await agent.resumeStream(
      { value: 'ready' },
      {
        runId: initial.runId,
        toolCallId: suspension.toolCallId,
      },
    );
    await resumed.consumeStream();

    expect(await resumed.finishReason).toBe('stop');
    expect(await resumed.text).toBe('continued after resume');
    expect(modelCall).toBe(2);
  });
});
