// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, rstest, test } from '@rstest/core';

import {
  createJevEvaluator,
  evaluateJevQuestions,
} from '../agent/common/jev-evaluator.js';
import type {
  JevModelInteraction,
  JevQuestion,
} from '../agent/common/jev-evaluator.js';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function questions(count: number): Record<string, JevQuestion> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `question_${index}`,
      {
        type: 'choice',
        instructions: 'Choose a value.',
        criteria: { a: 'A', b: 'B' },
      },
    ]),
  );
}

function result(batch: Record<string, JevQuestion>, inputTokens = 100) {
  return {
    answers: Object.fromEntries(Object.keys(batch).map(id => [id, 'b'])),
    usage: { inputTokens },
  };
}

afterEach(() => {
  rstest.restoreAllMocks();
});

describe('Jev actual model interaction diagnostics', () => {
  const config = {
    apiKey: 'private-api-key',
    baseURL: 'https://private.example.com/v1',
    model: 'private-upstream-model',
    input_price: 0,
    cached_price: 0,
    output_price: 0,
  };

  test('correlates concurrent requests, skips local choices and resets per invocation', async () => {
    const releaseFirst = gate();
    let calls = 0;
    const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
      async (_url, init) => {
        const index = ++calls;
        const body = JSON.parse(init!.body as string) as {
          questions: Record<string, JevQuestion>;
        };
        if (index === 1) await releaseFirst.promise;
        else releaseFirst.resolve();
        return Response.json({
          model: config.model,
          answers: Object.fromEntries(
            Object.keys(body.questions).map(id => [id, {
              type: 'choice',
              choice: 'b',
              probabilities: { b: 1 },
            }]),
          ),
          usage: { input_tokens: index * 100, output_tokens: 0 },
        });
      },
    );
    const events: JevModelInteraction[] = [];
    const evaluate = createJevEvaluator(config, event => events.push(event));
    const options = {
      evaluate,
      signal: new AbortController().signal,
      onUsage: rstest.fn(),
      phase: 'properties' as const,
    };
    await evaluateJevQuestions('private-state', {
      ...questions(33),
      local: {
        type: 'choice',
        instructions: 'private-copy',
        criteria: { only: 'private-choice' },
      },
    }, options);
    const starts = events.filter(event => event.status === 'started');
    expect(starts.map(event => event.requestIndex)).toEqual([1, 2]);
    expect(starts.map(event => event.request.questionCount)).toEqual([32, 1]);
    expect(starts.every(event => event.phase === 'properties')).toBe(true);
    expect(starts[0]!.questions).toHaveLength(32);
    expect(starts[0]!.questions![0]).toMatchObject({
      id: 'question_0',
      instructions: 'Choose a value.',
      choices: ['a', 'b'],
    });
    expect(starts[0]!.questions![0]!.answer).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const event of events.filter(item => item.status === 'completed')) {
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
      expect(event.questions).toHaveLength(event.request.questionCount);
      expect(event.questions!.every(q => q.answer !== undefined)).toBe(true);
      expect(event.response).toMatchObject({
        answerCount: event.request.questionCount,
        tokenUsage: { inputTokens: event.requestIndex * 100, outputTokens: 0 },
      });
    }
    expect(JSON.stringify(events)).not.toMatch(/private-/);
    await evaluateJevQuestions({}, questions(1), {
      ...options,
      phase: 'layout',
    });
    expect(events.at(-1)).toMatchObject({
      requestIndex: 3,
      phase: 'layout',
      status: 'completed',
    });
    const next = createJevEvaluator(config, event => events.push(event));
    await next('{}', questions(1), options.signal, 'components');
    expect(events.at(-1)?.requestIndex).toBe(1);
  });

  test.each(['upstream', 'cancelled'])(
    'records %s without leaking provider error bodies or fabricating usage',
    async failure => {
      const controller = new AbortController();
      const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
        () => {
          if (failure === 'cancelled') {
            const reason = new Error('private-cancel-reason');
            controller.abort(reason);
            return Promise.reject(reason);
          }
          return Promise.resolve(
            Response.json({ error: 'private-response-body' }, {
              status: 400,
            }),
          );
        },
      );
      const events: JevModelInteraction[] = [];
      const evaluate = createJevEvaluator(config, event => events.push(event));
      await expect(evaluate('{}', questions(1), controller.signal, 'copy'))
        .rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(events.map(event => event.status)).toEqual([
        'started',
        failure === 'cancelled' ? 'cancelled' : 'failed',
      ]);
      expect(events[1]?.response).toBeUndefined();
      expect(events[1]?.questions).toHaveLength(1);
      expect(events[1]?.questions![0]!.answer).toBeUndefined();
      if (failure === 'upstream') expect(events[1]?.statusCode).toBe(400);
      expect(JSON.stringify(events)).not.toMatch(/private-/);
    },
  );
});

describe('Jev independent evaluation batches', () => {
  test('resolves single-option questions without calling the model or recording usage', async () => {
    const evaluate = rstest.fn();
    const onUsage = rstest.fn();
    const answers = await evaluateJevQuestions({}, {
      parent: {
        type: 'choice',
        instructions: '',
        criteria: { root: 'Page root' },
      },
      property: {
        type: 'choice',
        instructions: '',
        criteria: { '': 'Default' },
      },
    }, { evaluate, onUsage, signal: new AbortController().signal });
    expect(answers).toEqual({ parent: 'root', property: '' });
    expect(evaluate).not.toHaveBeenCalled();
    expect(onUsage).not.toHaveBeenCalled();
  });

  test('runs two independent batches at a time, fills freed slots and keeps answer ordering', async () => {
    const gates = Array.from({ length: 3 }, gate);
    const starts = Array.from({ length: 3 }, gate);
    const onUsage = rstest.fn<(usage: unknown) => void>();
    let calls = 0;
    let active = 0;
    let peak = 0;
    const evaluate = rstest.fn(async (
      state: string,
      batch: Record<string, JevQuestion>,
    ) => {
      const index = calls++;
      active++;
      peak = Math.max(peak, active);
      expect(JSON.parse(state)).toEqual({ phase: 'properties' });
      expect(Object.keys(batch)).toHaveLength(index === 2 ? 16 : 32);
      expect(batch).not.toHaveProperty('parent');
      starts[index]!.resolve();
      await gates[index]!.promise;
      active--;
      return result(batch, index + 1);
    });
    const input = {
      parent: {
        type: 'choice' as const,
        instructions: '',
        criteria: { root: 'Root' },
      },
      ...questions(80),
    };
    const pending = evaluateJevQuestions({ phase: 'properties' }, input, {
      evaluate,
      onUsage,
      signal: new AbortController().signal,
    });
    await starts[1]!.promise;
    expect(calls).toBe(2);
    gates[1]!.resolve();
    await starts[2]!.promise;
    expect(active).toBe(2);
    gates[2]!.resolve();
    gates[0]!.resolve();
    const answers = await pending;
    expect(peak).toBe(2);
    expect(active).toBe(0);
    expect(answers).toEqual({
      parent: 'root',
      ...result(questions(80)).answers,
    });
    expect(Object.keys(answers)).toEqual(Object.keys(input));
    expect(onUsage.mock.calls.map(([usage]) => usage)).toEqual([
      { inputTokens: 2 },
      { inputTokens: 3 },
      { inputTokens: 1 },
    ]);
  });

  test.each(['invalid', 'upstream'])(
    'stops queued batches after %s failure and drains sibling usage before rejecting',
    async failure => {
      const first = gate();
      const sibling = gate();
      const cancelled = gate();
      const onUsage = rstest.fn<(usage: unknown) => void>();
      const upstreamError = new Error('Upstream unavailable');
      let calls = 0;
      const evaluate = rstest.fn(async (
        _state: string,
        batch: Record<string, JevQuestion>,
        signal: AbortSignal,
      ) => {
        const index = calls++;
        if (index === 0) {
          await first.promise;
          if (failure === 'upstream') throw upstreamError;
          return { ...result(batch), answers: {} };
        }
        signal.addEventListener('abort', () => cancelled.resolve(), {
          once: true,
        });
        // A completed response may still deliver usage after cancellation.
        await sibling.promise;
        return result(batch, 200);
      });
      let settled = false;
      const pending = evaluateJevQuestions({}, questions(80), {
        evaluate,
        onUsage,
        signal: new AbortController().signal,
      }).then(
        () => {
          settled = true;
          return undefined;
        },
        (error: unknown) => {
          settled = true;
          return error;
        },
      );
      first.resolve();
      await cancelled.promise;
      expect(settled).toBe(false);
      expect(calls).toBe(2);
      sibling.resolve();
      const error = await pending;
      if (failure === 'upstream') {
        expect(error).toBe(upstreamError);
      } else {
        expect(error).toMatchObject({
          message: expect.stringContaining('unoffered') as string,
        });
      }
      expect(onUsage.mock.calls.map(([usage]) => usage)).toEqual(
        failure === 'upstream'
          ? [{ inputTokens: 200 }]
          : [{ inputTokens: 100 }, { inputTokens: 200 }],
      );
      expect(calls).toBe(2);
    },
  );

  test('propagates cancellation to both active requests without starting queued work', async () => {
    const controller = new AbortController();
    const reason = new Error('Client disconnected');
    const signals: AbortSignal[] = [];
    const onUsage = rstest.fn();
    const evaluate = rstest.fn((
      _state: string,
      _batch: Record<string, JevQuestion>,
      signal: AbortSignal,
    ) => {
      signals.push(signal);
      return new Promise<ReturnType<typeof result>>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(reason), {
          once: true,
        });
      });
    });
    const pending = evaluateJevQuestions({}, questions(80), {
      evaluate,
      onUsage,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toBe(reason);
    expect(evaluate).toHaveBeenCalledTimes(2);
    controller.abort(reason);
    await rejected;
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(onUsage).not.toHaveBeenCalled();
  });

  test('rejects impossible questions and already cancelled phases before calling the model', async () => {
    const evaluate = rstest.fn();
    const onUsage = rstest.fn();
    const controller = new AbortController();
    const options = { evaluate, onUsage, signal: controller.signal };
    await expect(evaluateJevQuestions({}, {
      empty: { type: 'choice', instructions: '', criteria: {} },
    }, options)).rejects.toThrow('no available choices');
    controller.abort(new Error('Cancelled'));
    await expect(evaluateJevQuestions({}, {}, options)).rejects.toThrow(
      'Cancelled',
    );
    expect(evaluate).not.toHaveBeenCalled();
  });
});
