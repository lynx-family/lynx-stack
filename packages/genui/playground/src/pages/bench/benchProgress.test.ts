// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import {
  mergeBenchRunProgress,
  resolveBenchRunProgress,
} from './benchProgress.js';
import type { BenchRunProgress } from './benchReportTypes.js';

const first: BenchRunProgress = {
  groupId: 'group-1',
  scenarioId: 'case',
  repeatIndex: 1,
  revision: 4,
  phase: 'judge',
  generation: 'complete',
  screenshot: 'complete',
  judge: 'running',
};

test('merges concurrent groups and repeats without rewinding states on SSE replay', () => {
  const second = {
    ...first,
    groupId: 'group-2',
    phase: 'agent',
    generation: 'running' as const,
    revision: 1,
  };
  const repeated = { ...first, repeatIndex: 2, revision: 1 };
  const runs = mergeBenchRunProgress([first], [second, repeated]);
  const replay = mergeBenchRunProgress(runs, {
    ...first,
    phase: 'agent',
    revision: 2,
  });
  expect(replay).toEqual([first, second, repeated]);
  expect(mergeBenchRunProgress(replay, [null, { groupId: 'bad' }])).toEqual(
    replay,
  );
  expect(
    mergeBenchRunProgress(replay, {
      ...first,
      phase: 'complete',
      judge: 'complete',
      revision: 5,
    })[0]?.phase,
  ).toBe('complete');
});

test('cancellation preserves completed stages and old Judge failures do not invent a capture outcome', () => {
  expect(resolveBenchRunProgress(first, first, undefined, 'cancelled', true))
    .toMatchObject({
      phase: 'cancelled',
      generation: 'complete',
      screenshot: 'complete',
      judge: 'cancelled',
    });
  const legacy = resolveBenchRunProgress(
    first,
    undefined,
    {
      id: 'old',
      groupId: 'group-1',
      groupName: 'Group',
      scenarioId: 'case',
      scenarioName: 'Case',
      role: 'control',
      ok: false,
      judgeStatus: 'failed',
      error: 'Capture or scoring failed',
      agentMs: 100,
      attempts: 1,
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      tokens: 10,
      judgeScore: 0,
    },
    'complete',
    true,
  );
  expect(legacy).toMatchObject({
    phase: 'failed',
    generation: 'complete',
    screenshot: 'unknown',
    judge: 'unknown',
  });
});
