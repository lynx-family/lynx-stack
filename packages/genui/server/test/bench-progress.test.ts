// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import eventsRoute from '../app/a2ui/bench/jobs/[jobId]/events/route.js';
import { finishBenchRunProgress } from '../service/common/bench/progress.js';
import { getBenchJobStore } from '../service/common/bench/store.js';
import type {
  BenchJobRequest,
  BenchRunProgress,
} from '../service/common/bench/types.js';

const request: BenchJobRequest = {
  provider: {},
  groups: [{
    id: 'group',
    name: 'Group',
    role: 'control',
    variable: 'custom',
    enabled: true,
  }],
  scenarios: [{
    id: 'case',
    name: 'Case',
    prompt: 'Show a card',
    type: 'Information',
  }],
  settings: {
    repeats: 2,
    judgeEnabled: true,
    maxRepairAttempts: 0,
    repairEnabled: false,
    renderMetricsEnabled: false,
  },
};

test('a reconnect receives all run states even after their phase events were evicted', async () => {
  const store = getBenchJobStore();
  const job = store.createJob(request, 2);
  store.updateProgress(job.id, {
    current: {
      groupId: 'group',
      scenarioId: 'case',
      repeatIndex: 1,
      phase: 'judge',
    },
  });
  for (let index = 0; index < 510; index++) {
    store.emit(job.id, 'tick', { index });
  }
  const eventCount = job.events.length;
  const response = await eventsRoute.request(`/${job.id}/events`);
  const reader = response.body!.getReader();
  try {
    const decoder = new TextDecoder();
    let latest = '';
    for (let index = 0; index <= eventCount; index++) {
      const chunk = await reader.read();
      latest = decoder.decode(chunk.value);
    }
    expect(latest).toContain('event: job');
    const data = latest.split('\n').find(line => line.startsWith('data: '))
      ?.slice(6);
    expect(JSON.parse(data!)).toMatchObject({
      progress: {
        runs: [
          {
            repeatIndex: 1,
            phase: 'judge',
            generation: 'complete',
            screenshot: 'complete',
            judge: 'running',
          },
          {
            repeatIndex: 2,
            phase: 'queued',
            generation: 'queued',
            screenshot: 'pending',
            judge: 'pending',
          },
        ],
      },
    });
  } finally {
    await reader.cancel();
    store.cancelJob(job.id);
    job.workerActive = false;
  }
});

test.each(
  [
    {
      phase: 'agent',
      generation: 'running',
      screenshot: 'pending',
      judge: 'pending',
      judgeStatus: 'skipped',
      expected: ['failed', 'skipped', 'skipped'],
    },
    {
      phase: 'screenshot',
      generation: 'complete',
      screenshot: 'running',
      judge: 'pending',
      judgeStatus: 'failed',
      expected: ['complete', 'failed', 'skipped'],
    },
    {
      phase: 'judge',
      generation: 'complete',
      screenshot: 'complete',
      judge: 'running',
      judgeStatus: 'failed',
      expected: ['complete', 'complete', 'failed'],
    },
  ] as const,
)(
  'attributes a $phase failure to the correct stage',
  ({ phase, generation, screenshot, judge, judgeStatus, expected }) => {
    const current: BenchRunProgress = {
      groupId: 'group',
      scenarioId: 'case',
      repeatIndex: 1,
      revision: 1,
      phase,
      generation,
      screenshot,
      judge,
    };
    const result = finishBenchRunProgress(current, {
      ok: false,
      judgeStatus,
      errors: ['failure'],
    });
    expect([result.generation, result.screenshot, result.judge]).toEqual(
      expected,
    );
    expect(result.phase).toBe('failed');
    expect(result.error).toBe('failure');
  },
);
