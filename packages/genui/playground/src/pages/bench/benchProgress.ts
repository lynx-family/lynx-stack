// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BenchResult,
  BenchRunProgress,
  BenchStatus,
} from './benchReportTypes.js';

const STAGE_STATUSES = new Set([
  'pending',
  'queued',
  'running',
  'complete',
  'failed',
  'skipped',
  'cancelled',
  'unknown',
]);

export function benchRunKey(
  run: Pick<BenchRunProgress, 'groupId' | 'scenarioId'> & {
    repeatIndex?: number;
  },
): string {
  return JSON.stringify([run.groupId, run.scenarioId, run.repeatIndex ?? 1]);
}

function isRunProgress(value: unknown): value is BenchRunProgress {
  if (!value || typeof value !== 'object') return false;
  const run = value as Record<string, unknown>;
  return typeof run.groupId === 'string' && typeof run.scenarioId === 'string'
    && typeof run.repeatIndex === 'number' && Number.isInteger(run.repeatIndex)
    && run.repeatIndex > 0
    && typeof run.revision === 'number' && Number.isInteger(run.revision)
    && run.revision >= 0
    && typeof run.phase === 'string'
    && [run.generation, run.screenshot, run.judge].every(status =>
      typeof status === 'string' && STAGE_STATUSES.has(status)
    )
    && (run.error === undefined || typeof run.error === 'string');
}

/** Replayed events must not rewind runs restored from a newer snapshot. */
export function mergeBenchRunProgress(
  current: readonly BenchRunProgress[],
  incoming: unknown,
): BenchRunProgress[] {
  const next = new Map(current.map(run => [benchRunKey(run), run]));
  for (const value of Array.isArray(incoming) ? incoming : [incoming]) {
    if (!isRunProgress(value)) continue;
    const key = benchRunKey(value);
    if ((next.get(key)?.revision ?? -1) < value.revision) next.set(key, value);
  }
  return [...next.values()];
}

export function resolveBenchRunProgress(
  identity: Pick<BenchRunProgress, 'groupId' | 'scenarioId' | 'repeatIndex'>,
  progress: BenchRunProgress | undefined,
  result: BenchResult | undefined,
  status: BenchStatus,
  judgeEnabled: boolean,
): BenchRunProgress {
  const fallback: BenchRunProgress = {
    ...identity,
    revision: 0,
    phase: 'queued',
    generation: 'queued',
    screenshot: judgeEnabled ? 'pending' : 'skipped',
    judge: judgeEnabled ? 'pending' : 'skipped',
  };
  // Old reports can establish outcomes, but not the exact stage of a Judge failure.
  if (result) {
    const failed = result.ok === false || result.status === 'failed';
    fallback.phase = failed ? 'failed' : 'complete';
    fallback.generation = failed && result.judgeStatus !== 'failed'
        && result.judgeStatus !== 'complete'
      ? 'failed'
      : 'complete';
    fallback.error = result.error ?? result.errors?.join('; ');
    if (result.judgeStatus === 'complete') {
      fallback.screenshot = 'complete';
      fallback.judge = 'complete';
    } else if (result.judgeStatus === 'skipped' || !judgeEnabled) {
      fallback.screenshot = 'skipped';
      fallback.judge = 'skipped';
    } else {
      fallback.screenshot = result.screenshotDataUrl ? 'complete' : 'unknown';
      fallback.judge =
        result.screenshotDataUrl && result.judgeStatus === 'failed'
          ? 'failed'
          : 'unknown';
    }
  }
  const run = progress ?? fallback;
  if (['complete', 'failed', 'cancelled'].includes(run.phase)) return run;
  if (status === 'complete') {
    return {
      ...run,
      phase: 'unknown',
      generation: 'unknown',
      screenshot: 'unknown',
      judge: 'unknown',
    };
  }
  if (status !== 'cancelled' && status !== 'failed') return run;
  // Pause closes the stream immediately; reflect cancellation without waiting for replay.
  if (run.generation !== 'complete') {
    return {
      ...run,
      phase: 'cancelled',
      generation: 'cancelled',
      screenshot: 'skipped',
      judge: 'skipped',
    };
  }
  if (run.screenshot !== 'complete') {
    return {
      ...run,
      phase: 'cancelled',
      screenshot: run.screenshot === 'skipped' ? 'skipped' : 'cancelled',
      judge: 'skipped',
    };
  }
  return {
    ...run,
    phase: 'cancelled',
    judge: run.judge === 'skipped' ? 'skipped' : 'cancelled',
  };
}
