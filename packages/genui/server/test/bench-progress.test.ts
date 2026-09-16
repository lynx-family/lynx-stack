// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import eventsRoute from '../app/a2ui/bench/jobs/[jobId]/events/route.js';
import { finishBenchRunProgress } from '../service/common/bench/progress.js';
import {
  BenchJobStore,
  getBenchJobStore,
} from '../service/common/bench/store.js';
import type {
  BenchJobRequest,
  BenchRunProgress,
} from '../service/common/bench/types.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

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

test('keeps model-based plan ids correlated in snapshots, events and reports', () => {
  const model = 'public-model';
  rstest.stubEnv(
    GENUI_MODEL_CONFIG_ENV,
    JSON.stringify({
      [model]: {
        model,
        apiKey: 'private-key',
        baseURL: 'https://provider.example/v1',
      },
    }),
  );
  try {
    const store = new BenchJobStore();
    const groupId = `preset-${model}`;
    const scenarioId = `scenario-${model}`;
    const job = store.createJob({
      ...request,
      groups: [{ ...request.groups[0]!, id: groupId, model }],
      scenarios: [{ ...request.scenarios[0]!, id: scenarioId }],
    }, 2);
    expect(store.getSnapshot(job.id)?.progress.runs?.[0]).toMatchObject({
      groupId,
      scenarioId,
      phase: 'queued',
    });
    store.updateProgress(job.id, {
      current: { groupId, scenarioId, repeatIndex: 1, phase: 'judge' },
    });
    store.emit(job.id, 'run-phase', {
      runProgress: job.progress.runs?.[0],
      error: `${model} private-key`,
      unknown: { id: `unrecognized-${model}` },
    });
    expect(job.events.at(-1)?.data).toMatchObject({
      runProgress: {
        groupId,
        scenarioId,
        phase: 'judge',
        generation: 'complete',
        screenshot: 'complete',
        judge: 'running',
      },
      error: '[REDACTED] [REDACTED]',
      unknown: { id: 'unrecognized-[REDACTED]' },
    });
    expect(store.getSnapshot(job.id)?.progress.current?.groupId).toBe(groupId);
    store.cancelJob(job.id);
    store.setReport(job.id, {
      id: 'report',
      jobId: job.id,
      createdAt: job.createdAt,
      completedAt: job.updatedAt,
      status: 'cancelled',
      env: { model },
      settings: job.request.settings,
      capabilities: {
        agent: 'enabled',
        judge: 'enabled',
        renderMetrics: 'disabled',
      },
      warnings: [],
      groups: job.request.groups,
      scenarios: job.request.scenarios,
      results: [],
      summaries: [],
      summary: {
        totalRuns: 2,
        completedRuns: 0,
        failedRuns: 0,
        successRate: 0,
        avgTokens: 0,
        avgAgentMs: 0,
        avgAttempts: 0,
      },
    });
    expect(job.report?.groups[0]?.id).toBe(groupId);
    expect(job.report?.scenarios[0]?.id).toBe(scenarioId);
    expect(job.report?.runProgress?.[0]).toMatchObject({
      groupId,
      scenarioId,
      phase: 'cancelled',
      generation: 'complete',
      screenshot: 'complete',
      judge: 'cancelled',
    });
  } finally {
    rstest.unstubAllEnvs();
  }
});

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
