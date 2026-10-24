// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { recoverTextGeneration } from '../service/common/text-generation-recovery.js';
import type {
  ChatMessage,
  MastraStreamResult,
} from '../service/common/types.js';

const INITIAL: ChatMessage[] = [
  { role: 'system', content: 'Return a complete artifact.' },
  { role: 'user', content: 'Make a card.' },
];
const PREFIX = '<artifact>const text = "keep spaces   ';
const SUFFIX = 'and finish";</artifact>';
const COMPLETE = PREFIX + SUFFIX;
const USAGE = {
  inputTokens: { total: 10, cacheRead: 3, cacheWrite: 0 },
  outputTokens: { total: 20, reasoning: 2 },
};
const REASONING_USAGE = {
  inputTokens: { total: 8010, cacheRead: 6144 },
  outputTokens: { total: 16384, text: 0, reasoning: 16384 },
};
const REASONING_RECOVERY = {
  maxOutputTokens: 16384,
  retrySettings: { maxOutputTokens: 32768, reasoningEffort: 'low' as const },
};
const INPUT_ERROR =
  'The parameter `input` specified in the request are not valid: `<nil>`.';

function reasoningFailure(overrides: Partial<MastraStreamResult> = {}) {
  return {
    ...streamResult('', 'error'),
    usage: REASONING_USAGE,
    error: Object.assign(new Error(INPUT_ERROR), {
      statusCode: 400,
      responseHeaders: { 'x-request-id': 'reasoning-request' },
    }),
    ...overrides,
  };
}

function streamResult(
  text: string,
  finishReason = 'stop',
): MastraStreamResult {
  return {
    textStream: {
      [Symbol.asyncIterator]: async function*() {
        yield await Promise.resolve(text);
      },
    },
    // Exercise the fallback when a provider only returns streamed text.
    usage: USAGE,
    finishReason,
  };
}

function postprocess(result: { text: string }) {
  if (
    !result.text.startsWith('<artifact>')
    || !result.text.endsWith('</artifact>')
  ) {
    throw new Error('Incomplete artifact');
  }
  return { text: result.text, metadata: { modelOutput: result.text } };
}

async function drain(stream: { textStream: AsyncIterable<string> }) {
  let text = '';
  for await (const chunk of stream.textStream) text += chunk;
  return text;
}

describe('bounded text generation recovery', () => {
  test.each(['length', 'error'])(
    'restarts reasoning-only %s with changed settings and preserves the initial evidence',
    async finishReason => {
      let calls = 0;
      const initial = finishReason === 'error'
        ? reasoningFailure()
        : reasoningFailure({ finishReason, error: undefined });
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: initial,
        reasoningRecovery: REASONING_RECOVERY,
        maxAttempts: 3,
        stream(messages, settings) {
          calls++;
          expect(settings).toEqual(REASONING_RECOVERY.retrySettings);
          expect(messages.slice(0, -1)).toEqual(INITIAL);
          expect(messages.some(message => message.role === 'assistant')).toBe(
            false,
          );
          expect(messages.at(-1)?.content).toContain('Keep reasoning brief');
          return Promise.resolve(streamResult(COMPLETE));
        },
        postprocess,
        canContinue: () => true,
      });
      expect(await drain(stream)).toBe('');
      const result = await stream.finalize();
      expect(result.text).toBe(COMPLETE);
      expect(result.usage).toMatchObject({
        inputTokens: 8020,
        outputTokens: 16404,
        reasoningTokens: 16386,
      });
      expect(result.metadata).toMatchObject({
        generationAttempts: [
          {
            mode: 'initial',
            finishReason,
            ...(finishReason === 'error'
              ? {
                error: {
                  statusCode: 400,
                  upstreamRequestId: 'reasoning-request',
                },
              }
              : {}),
          },
          { mode: 'regenerate', finishReason: 'stop' },
        ],
      });
      expect(calls).toBe(1);
    },
  );

  test.each([
    { usage: undefined },
    { usage: USAGE },
    {
      usage: { inputTokens: 8010, outputTokens: 16384, reasoningTokens: 16383 },
    },
    { text: PREFIX },
    { text: '', textStream: streamResult(PREFIX).textStream },
    { content: [{ type: 'tool-call' }] },
    {
      content: {
        then() {
          throw new Error('Content unavailable');
        },
      },
    },
    { error: Object.assign(new Error(INPUT_ERROR), { statusCode: 401 }) },
    {
      error: Object.assign(new Error('Invalid input schema'), {
        statusCode: 400,
      }),
    },
  ])('does not recover a different upstream failure (%#)', async overrides => {
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: reasoningFailure(overrides),
      reasoningRecovery: REASONING_RECOVERY,
      maxAttempts: 3,
      stream() {
        throw new Error('Unexpected retry');
      },
      postprocess,
      canContinue: () => true,
    });
    await drain(stream);
    await expect(stream.finalize()).rejects.toMatchObject({
      name: 'GenerationUpstreamError',
      result: { finishReason: 'error' },
    });
  });

  test('bounds reasoning failure recovery to one attempt and retains both usages', async () => {
    let calls = 0;
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: reasoningFailure(),
      reasoningRecovery: REASONING_RECOVERY,
      maxAttempts: 3,
      stream() {
        calls++;
        return Promise.resolve(reasoningFailure());
      },
      postprocess,
      canContinue: () => true,
    });
    await drain(stream);
    await expect(stream.finalize()).rejects.toMatchObject({
      name: 'GenerationUpstreamError',
      message: INPUT_ERROR,
      statusCode: 400,
      upstreamRequestId: 'reasoning-request',
      result: {
        usage: {
          inputTokens: 16020,
          outputTokens: 32768,
          reasoningTokens: 32768,
        },
        finishReason: 'error',
      },
    });
    expect(calls).toBe(1);
  });

  test('can finish a truncated regenerated artifact without restoring its exhausted settings', async () => {
    let calls = 0;
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: reasoningFailure(),
      reasoningRecovery: REASONING_RECOVERY,
      maxAttempts: 3,
      stream(_messages, settings) {
        calls++;
        expect(settings).toEqual(REASONING_RECOVERY.retrySettings);
        return Promise.resolve(
          calls === 1
            ? streamResult(PREFIX, 'length')
            : streamResult(COMPLETE),
        );
      },
      postprocess,
      canContinue: () => true,
    });
    await drain(stream);
    const result = await stream.finalize();
    expect(result.text).toBe(COMPLETE);
    expect(calls).toBe(2);
  });

  test('cancels before reasoning recovery without another request', async () => {
    const controller = new AbortController();
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: reasoningFailure(),
      reasoningRecovery: REASONING_RECOVERY,
      maxAttempts: 3,
      stream() {
        throw new Error('Unexpected retry');
      },
      postprocess,
      canContinue: () => true,
      abortSignal: controller.signal,
      onPerformanceEvent() {
        controller.abort(new Error('Cancelled'));
      },
    });
    await drain(stream);
    await expect(async () => stream.finalize()).rejects.toThrow('Cancelled');
  });

  test('preserves exact whitespace at the continuation boundary and totals all usage', async () => {
    const calls: ChatMessage[][] = [];
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: streamResult(PREFIX, 'length'),
      maxAttempts: 3,
      stream(messages) {
        calls.push(messages);
        return Promise.resolve(streamResult(COMPLETE));
      },
      postprocess,
      canContinue: text => text.startsWith('<artifact>'),
    });
    expect(await drain(stream)).toBe(PREFIX);
    const final = await stream.finalize();
    expect(final.text).toBe(COMPLETE);
    expect(final.usage).toEqual({
      inputTokens: 20,
      outputTokens: 40,
      totalTokens: 60,
      cachedTokens: 6,
      cacheWriteTokens: 0,
      reasoningTokens: 4,
    });
    expect(final.metadata).toMatchObject({
      generationAttempts: [
        { mode: 'initial', finishReason: 'length' },
        { mode: 'continue', finishReason: 'stop' },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.slice(0, 2)).toEqual(INITIAL);
    expect(calls[0]?.[2]).toEqual({ role: 'assistant', content: PREFIX });
    expect(calls[0]?.[3]?.content).toContain(JSON.stringify(PREFIX));
    expect(INITIAL).toHaveLength(2);
  });

  test.each([SUFFIX, PREFIX, '<artifact>changed</artifact>'])(
    'regenerates instead of guessing the boundary for %s',
    async continuation => {
      const calls: ChatMessage[][] = [];
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: streamResult(PREFIX, 'length'),
        maxAttempts: 3,
        stream(messages) {
          calls.push(messages);
          return Promise.resolve(
            streamResult(calls.length === 1 ? continuation : COMPLETE),
          );
        },
        postprocess,
        canContinue: () => true,
      });
      expect(await drain(stream)).toBe(PREFIX);
      const final = await stream.finalize();
      expect(final.text).toBe(COMPLETE);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.slice(0, -1)).toEqual(INITIAL);
      expect(calls[1]?.at(-1)?.content).toContain('Regenerate a shorter');
      expect(final.metadata).toMatchObject({
        generationAttempts: [
          { mode: 'initial' },
          { mode: 'continue' },
          { mode: 'regenerate' },
        ],
      });
    },
  );

  test.each([
    '',
    'Reasoning without an artifact',
    '<artifact>' + 'a'.repeat(128 * 1024),
  ])(
    'regenerates empty, absent, or oversized prefixes (%#)',
    async prefix => {
      const calls: ChatMessage[][] = [];
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: streamResult(prefix, 'length'),
        maxAttempts: 3,
        stream(messages) {
          calls.push(messages);
          return Promise.resolve(streamResult(COMPLETE, 'length'));
        },
        postprocess,
        canContinue: text => text.startsWith('<artifact>'),
      });
      await drain(stream);
      const final = await stream.finalize();
      expect(final.text).toBe(COMPLETE);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.slice(0, -1)).toEqual(INITIAL);
      expect(calls[0]?.at(-1)?.content).toContain('Regenerate a shorter');
    },
  );

  test.each(['stop', 'length'])(
    'accepts a valid artifact ending with %s without recovery',
    async finishReason => {
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: streamResult(COMPLETE, finishReason),
        maxAttempts: 3,
        stream() {
          throw new Error('Unexpected extra model call');
        },
        postprocess,
        canContinue: () => true,
      });
      expect(await drain(stream)).toBe(COMPLETE);
      expect(await stream.finalize()).toEqual({
        text: COMPLETE,
        metadata: { modelOutput: COMPLETE },
        usage: USAGE,
        finishReason,
      });
    },
  );

  test.each(['stop', 'length'])(
    'bounds invalid output ending with %s and retains failure usage',
    async finishReason => {
      let calls = 1;
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: streamResult('', finishReason),
        maxAttempts: 99,
        stream() {
          calls++;
          return Promise.resolve(streamResult('', finishReason));
        },
        postprocess,
        canContinue: () => false,
      });
      await drain(stream);
      await expect(stream.finalize()).rejects.toMatchObject({
        name: 'GenerationPostprocessError',
        result: {
          text: '',
          usage: finishReason === 'stop'
            ? USAGE
            : { inputTokens: 30, outputTokens: 60 },
          finishReason,
        },
      });
      expect(calls).toBe(finishReason === 'stop' ? 1 : 3);
    },
  );

  test('does not regenerate on an upstream failure during continuation', async () => {
    let calls = 1;
    const stream = recoverTextGeneration({
      initialMessages: INITIAL,
      initialResult: streamResult(PREFIX, 'length'),
      maxAttempts: 3,
      stream() {
        calls++;
        return Promise.resolve({
          ...streamResult('', 'error'),
          error: Object.assign(new Error('Provider failed'), {
            statusCode: 429,
          }),
        });
      },
      postprocess,
      canContinue: () => true,
    });
    await drain(stream);
    await expect(stream.finalize()).rejects.toMatchObject({
      name: 'GenerationUpstreamError',
      statusCode: 429,
      result: {
        usage: { inputTokens: 20, outputTokens: 40 },
        finishReason: 'error',
      },
    });
    expect(calls).toBe(2);
  });

  test.each([false, true])(
    'honors cancellation during recovery (%s)',
    async duringContinuation => {
      const controller = new AbortController();
      let calls = 1;
      const stream = recoverTextGeneration({
        initialMessages: INITIAL,
        initialResult: streamResult(PREFIX, 'length'),
        maxAttempts: 3,
        stream() {
          calls++;
          return Promise.resolve({
            ...streamResult(COMPLETE),
            textStream: {
              [Symbol.asyncIterator]: async function*() {
                controller.abort(new Error('Cancelled'));
                yield await Promise.resolve(COMPLETE);
              },
            },
          });
        },
        postprocess,
        canContinue: () => true,
        abortSignal: controller.signal,
        onPerformanceEvent: () => {
          if (!duringContinuation) controller.abort(new Error('Cancelled'));
        },
      });
      await drain(stream);
      await expect(async () => stream.finalize()).rejects.toThrow('Cancelled');
      expect(calls).toBe(duringContinuation ? 2 : 1);
    },
  );
});
