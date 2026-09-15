// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BenchJobRequest,
  BenchProgress,
  BenchRunPhase,
  BenchRunProgress,
  BenchRunResult,
} from './types.js';

export function createBenchRunProgress(
  request: BenchJobRequest,
): BenchRunProgress[] {
  return request.groups.filter(group => group.enabled).flatMap(group =>
    request.scenarios.flatMap(scenario =>
      Array.from({ length: request.settings.repeats }, (_, index) => ({
        groupId: group.id,
        scenarioId: scenario.id,
        repeatIndex: index + 1,
        revision: 0,
        phase: 'queued' as const,
        generation: 'queued' as const,
        screenshot: request.settings.judgeEnabled
          ? 'pending' as const
          : 'skipped' as const,
        judge: request.settings.judgeEnabled
          ? 'pending' as const
          : 'skipped' as const,
      }))
    )
  );
}

/** Phase events carry one run; full snapshots carry the whole plan. */
export function benchProgressSummary(
  progress: BenchProgress,
): Omit<BenchProgress, 'runs'> {
  return {
    completedRuns: progress.completedRuns,
    totalRuns: progress.totalRuns,
    ...(progress.current ? { current: progress.current } : {}),
  };
}

export function advanceBenchRunProgress(
  current: BenchRunProgress,
  phase: BenchRunPhase,
): BenchRunProgress {
  const next = { ...current, phase, revision: current.revision + 1 };
  if (phase === 'agent' || phase === 'validate') next.generation = 'running';
  if (
    phase === 'screenshot-queued' || phase === 'screenshot'
    || phase === 'render'
  ) {
    next.generation = 'complete';
    next.screenshot = phase === 'screenshot-queued' ? 'queued' : 'running';
    next.judge = 'pending';
  }
  if (phase === 'judge-queued' || phase === 'judge') {
    next.generation = 'complete';
    next.screenshot = 'complete';
    next.judge = phase === 'judge-queued' ? 'queued' : 'running';
  }
  if (phase === 'judge-retry') {
    if (next.screenshot !== 'complete') next.screenshot = 'queued';
    next.judge = next.screenshot === 'complete' ? 'queued' : 'pending';
  }
  return next;
}

export function finishBenchRunProgress(
  current: BenchRunProgress,
  result: Pick<BenchRunResult, 'ok' | 'judgeStatus' | 'error' | 'errors'>,
): BenchRunProgress {
  const next = {
    ...current,
    phase: result.ok ? 'complete' as const : 'failed' as const,
    revision: current.revision + 1,
    ...(result.ok ? {} : { error: result.error ?? result.errors.join('; ') }),
  };
  if (result.judgeStatus === 'complete') {
    next.generation = 'complete';
    next.screenshot = 'complete';
    next.judge = 'complete';
  } else if (result.judgeStatus === 'failed') {
    next.generation = 'complete';
    const scoring = current.screenshot === 'complete';
    next.screenshot = scoring ? 'complete' : 'failed';
    next.judge = scoring ? 'failed' : 'skipped';
  } else {
    next.generation = result.ok ? 'complete' : 'failed';
    next.screenshot = 'skipped';
    next.judge = 'skipped';
  }
  return next;
}

export function cancelBenchRunProgress(
  current: BenchRunProgress,
): BenchRunProgress {
  if (['complete', 'failed', 'cancelled'].includes(current.phase)) {
    return current;
  }
  const next = {
    ...current,
    phase: 'cancelled' as const,
    revision: current.revision + 1,
  };
  if (next.generation !== 'complete') {
    next.generation = 'cancelled';
    next.screenshot = 'skipped';
    next.judge = 'skipped';
  } else if (next.screenshot === 'complete') {
    next.judge = next.judge === 'skipped' ? 'skipped' : 'cancelled';
  } else {
    next.screenshot = next.screenshot === 'skipped' ? 'skipped' : 'cancelled';
    next.judge = 'skipped';
  }
  return next;
}
