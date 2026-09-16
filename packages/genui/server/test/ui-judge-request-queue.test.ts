// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import {
  UiJudgeRequestQueue,
  getUiJudgeRequestQueue,
} from '../agent/common/ui-judge-request-queue.js';

function controlledQueue() {
  let now = 0;
  const waits: number[] = [];
  let wake: () => void;
  const queue = new UiJudgeRequestQueue({
    now: () => now,
    sleep: (delay) => {
      waits.push(delay);
      return new Promise<void>((resolve) => {
        wake = () => {
          now += delay;
          resolve();
        };
      });
    },
  });
  return { queue, waits, advance: () => wake(), now: () => now };
}

test('paces request starts and admits at most two active calls in FIFO order', async () => {
  const clock = controlledQueue();
  const started: Array<{ index: number; time: number }> = [];
  const finish: Array<() => void> = [];
  const tasks = [0, 1, 2].map(index =>
    clock.queue.run(() => {
      started.push({ index, time: clock.now() });
      return new Promise<void>(resolve => {
        finish[index] = resolve;
      });
    })
  );
  await rstest.waitUntil(() =>
    started.length === 1 && clock.waits.length === 1
  );
  expect(clock.waits).toEqual([1_000]);
  clock.advance();
  await rstest.waitUntil(() => started.length === 2);
  expect(started).toEqual([{ index: 0, time: 0 }, { index: 1, time: 1_000 }]);
  finish[0]!();
  await rstest.waitUntil(() => clock.waits.length === 2);
  expect(started).toHaveLength(2);
  clock.advance();
  await rstest.waitUntil(() => started.length === 3);
  expect(started[2]).toEqual({ index: 2, time: 2_000 });
  finish[1]!();
  finish[2]!();
  await Promise.all(tasks);
});

test('a Retry-After cooldown also postpones other screenshots already waiting', async () => {
  const clock = controlledQueue();
  const retry = rstest.fn();
  const calls: Array<{ name: string; time: number }> = [];
  const limited = clock.queue.run(
    () => {
      calls.push({ name: 'limited', time: clock.now() });
      return calls.length === 1
        ? Promise.reject(Object.assign(new Error('RPM exceeded'), {
          statusCode: 429,
          responseHeaders: { 'Retry-After': '3' },
        }))
        : Promise.resolve('recovered');
    },
    undefined,
    retry,
  );
  const other = clock.queue.run(() => {
    calls.push({ name: 'other', time: clock.now() });
    return Promise.resolve('other');
  });
  await rstest.waitUntil(() =>
    clock.waits.length === 1 && retry.mock.calls.length === 1
  );
  clock.advance();
  await rstest.waitUntil(() => clock.waits.length === 2);
  expect(calls).toEqual([{ name: 'limited', time: 0 }]);
  expect(clock.waits).toEqual([1_000, 2_000]);
  clock.advance();
  await rstest.waitUntil(() => clock.waits.length === 3);
  expect(calls[1]).toEqual({ name: 'other', time: 3_000 });
  clock.advance();
  expect(await Promise.all([limited, other])).toEqual(['recovered', 'other']);
  expect(calls[2]).toEqual({ name: 'limited', time: 4_000 });
});

test('bounds persistent RPM failures to three calls with a minute between retries', async () => {
  let now = 0;
  const waits: number[] = [];
  const queue = new UiJudgeRequestQueue({
    now: () => now,
    sleep: (delay) => {
      waits.push(delay);
      now += delay;
      return Promise.resolve();
    },
  });
  const error = Object.assign(new Error('RPM exceeded'), { statusCode: 429 });
  const request = rstest.fn(() => Promise.reject(error));
  await expect(queue.run(request)).rejects.toBe(error);
  expect(request).toHaveBeenCalledTimes(3);
  expect(waits).toEqual([60_000, 60_000]);
});

test('cancels a queued retry promptly and preserves the cooldown for other work', async () => {
  const clock = controlledQueue();
  const controller = new AbortController();
  const request = rstest.fn(() =>
    Promise.reject(
      Object.assign(new Error('RPM exceeded'), { statusCode: 429 }),
    )
  );
  const pending = clock.queue.run(request, controller.signal);
  const rejected = expect(pending).rejects.toThrow('cancelled');
  await rstest.waitUntil(() => clock.waits.length === 1);
  controller.abort(new Error('cancelled'));
  await rejected;
  const next = rstest.fn(() => Promise.resolve('next'));
  const other = clock.queue.run(next);
  await rstest.waitUntil(() => clock.waits.length === 2);
  expect(next).not.toHaveBeenCalled();
  expect(clock.waits).toEqual([60_000, 60_000]);
  clock.advance();
  expect(await other).toBe('next');
  expect(request).toHaveBeenCalledTimes(1);
});

test.each([
  { statusCode: 401 },
  { statusCode: 429, isRetryable: false },
  { statusCode: 429, responseHeaders: { 'Retry-After': '61' } },
  new Error('Invalid score'),
])(
  'does not retry permanent or out-of-budget failures: %j',
  async (failure) => {
    const error = failure instanceof Error
      ? failure
      : Object.assign(new Error('Provider failure'), failure);
    const request = rstest.fn(() => Promise.reject(error));
    const queue = new UiJudgeRequestQueue();
    await expect(queue.run(request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  },
);

test('shares admission by resolved upstream endpoint and model', () => {
  const queue = getUiJudgeRequestQueue('https://judge.example/v1', 'upstream');
  expect(getUiJudgeRequestQueue('https://judge.example/v1/', 'upstream')).toBe(
    queue,
  );
  expect(getUiJudgeRequestQueue('https://other.example/v1', 'upstream')).not
    .toBe(queue);
  expect(getUiJudgeRequestQueue('https://judge.example/v1', 'other')).not.toBe(
    queue,
  );
});
