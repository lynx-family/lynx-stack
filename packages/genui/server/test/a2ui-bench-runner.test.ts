// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import { probeBenchUiJudge } from '../service/a2ui-bench-judge.js';
import { runBenchJob, summarizeGroup } from '../service/a2ui-bench-runner.js';
import { getBenchJobStore } from '../service/a2ui-bench-store.js';
import type {
  BenchGroupRequest,
  BenchJobRequest,
  BenchRunResult,
} from '../service/a2ui-bench-types.js';

rstest.mock('../service/a2ui-bench-judge.js', { mock: true });

const group: BenchGroupRequest = {
  enabled: true,
  id: 'control',
  name: 'Control',
  role: 'control',
  variable: 'custom',
};

function request(judgeEnabled = true): BenchJobRequest {
  return {
    groups: [group],
    provider: {},
    scenarios: [{
      id: 'scenario',
      name: 'Scenario',
      prompt: 'Build a card',
      type: 'Information',
    }],
    settings: {
      judgeEnabled,
      maxRepairAttempts: 0,
      parallelism: 1,
      renderMetricsEnabled: false,
      repairEnabled: false,
      repeats: 1,
    },
  };
}

function result(
  id: string,
  judgeStatus: BenchRunResult['judgeStatus'],
  judgeScore: number,
): BenchRunResult {
  return {
    agentMs: 10,
    attempts: 1,
    catalog: 'Full Catalog',
    errors: [],
    fmpMs: 0,
    groupId: group.id,
    groupName: group.name,
    id,
    judgeScore,
    judgeStatus,
    messageCount: 1,
    model: 'test-model',
    ok: true,
    outputChars: 10,
    renderMs: 0,
    repeatIndex: 1,
    role: group.role,
    scenarioId: 'scenario',
    scenarioName: 'Scenario',
    status: 'complete',
    tokens: 10,
    ttiMs: 0,
  };
}

describe('A2UI Bench UI Judge integration', () => {
  test('does not restore a cancelled job to running after the health probe', async () => {
    let resolveProbe:
      | ((capability: Awaited<ReturnType<typeof probeBenchUiJudge>>) => void)
      | undefined;
    rstest.mocked(probeBenchUiJudge).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const store = getBenchJobStore();
    const job = store.createJob(request(), 1);

    const running = runBenchJob(job.id);
    store.cancelJob(job.id);
    resolveProbe?.({
      enabled: false,
      reason: 'not ready',
    });
    await running;

    const completed = store.getJob(job.id);
    expect(completed?.status).toBe('cancelled');
    expect(completed?.report?.status).toBe('cancelled');
    expect(completed?.results).toEqual([]);
  });

  test('excludes failed and skipped Judge attempts from the average', () => {
    const summary = summarizeGroup(group, [
      result('complete', 'complete', 4),
      result('failed', 'failed', 0),
      result('skipped', 'skipped', 0),
    ]);

    expect(summary.avgJudgeScore).toBe(4);
    expect(summary.judgeRunCount).toBe(1);
  });
});
