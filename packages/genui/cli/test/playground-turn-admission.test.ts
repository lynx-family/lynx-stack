// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  retryTurnAdmission,
  submitTurnWithSessionRetry,
} from '../src/playground/browser/turn-admission.js';

describe('control UI turn admission', () => {
  test('retries only the structured active-turn conflict with bounded exponential backoff', async () => {
    const times: number[] = [];
    const waits: number[] = [];
    let now = 0;
    let attempts = 0;
    const result = await retryTurnAdmission(async () => {
      times.push(now);
      attempts += 1;
      if (attempts < 7) {
        throw failure(409, 'ACTIVE_TURN_EXISTS');
      }
      return await Promise.resolve('accepted');
    }, {
      now: () => now,
      wait: (delay) => {
        waits.push(delay);
        now += delay;
        return Promise.resolve();
      },
    });
    expect(result).toBe('accepted');
    expect(times).toEqual([0, 100, 300, 700, 1_500, 2_500, 3_500]);
    expect(waits).toEqual([100, 200, 400, 800, 1_000, 1_000]);
  });

  test.each([
    failure(500, 'ACTIVE_TURN_EXISTS'),
    failure(409, 'ID_CONFLICT'),
    new Error('network failure'),
  ])('does not retry a non-admission failure', async (failure) => {
    let attempts = 0;
    await expect(retryTurnAdmission(() => {
      attempts += 1;
      throw failure;
    })).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  test('never schedules beyond the single 15 second budget', async () => {
    const waits: number[] = [];
    let now = 0;
    let attempts = 0;
    await expect(retryTurnAdmission(() => {
      attempts += 1;
      throw failure(409, 'ACTIVE_TURN_EXISTS');
    }, {
      now: () => now,
      wait: (delay) => {
        waits.push(delay);
        now += delay;
        return Promise.resolve();
      },
    })).rejects.toMatchObject({
      status: 409,
      code: 'ACTIVE_TURN_EXISTS',
    });
    expect(waits.reduce((total, delay) => total + delay, 0)).toBe(15_000);
    expect(Math.max(...waits)).toBe(1_000);
    expect(attempts).toBe(waits.length);
  });

  test('retries session admission and turn admission as one same-id operation', async () => {
    const bodies: unknown[] = [];
    const body = {
      sessionId: 'fixed-session',
      prompt: 'fixed prompt',
      agentId: 'codex',
    };
    let sessions = 0;
    let turns = 0;
    let now = 0;
    const result = await submitTurnWithSessionRetry(
      () => {
        sessions += 1;
        if (sessions === 1) {
          return Promise.reject(failure(409, 'ACTIVE_TURN_EXISTS'));
        }
        return Promise.resolve();
      },
      () => {
        turns += 1;
        bodies.push(body);
        return Promise.resolve('accepted');
      },
      {
        now: () => now,
        wait: (delay) => {
          now += delay;
          return Promise.resolve();
        },
      },
    );
    expect(result).toBe('accepted');
    expect(sessions).toBe(2);
    expect(turns).toBe(1);
    expect(bodies).toEqual([body]);
  });
});

function failure(status: number, code: string): Error & {
  status: number;
  code: string;
} {
  return Object.assign(new Error(code), { status, code });
}
