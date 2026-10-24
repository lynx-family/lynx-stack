// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchGroup, BenchScenario } from './benchData.js';
import { benchRunKey, resolveBenchRunProgress } from './benchProgress.js';
import type {
  BenchResult,
  BenchRunProgress,
  BenchStageStatus,
  BenchStatus,
} from './benchReportTypes.js';

const STAGE_LABELS: Record<BenchStageStatus, string> = {
  pending: 'Pending',
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
  unknown: 'Not recorded',
};
const PHASE_LABELS: Record<string, string> = {
  queued: 'Queued',
  agent: 'Generating',
  validate: 'Validating',
  'screenshot-queued': 'Waiting for screenshot',
  screenshot: 'Capturing',
  render: 'Rendering',
  'judge-queued': 'Waiting for score',
  'judge-retry': 'Waiting to retry',
  judge: 'Scoring',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const STAGES = [
  ['generation', 'Generate & validate'],
  ['screenshot', 'Screenshot & upload'],
  ['judge', 'UI Judge'],
] as const;

export function BenchRunWorkflow(props: {
  groups: readonly BenchGroup[];
  scenarios: readonly BenchScenario[];
  repeats: number;
  runs: readonly BenchRunProgress[];
  results?: readonly BenchResult[];
  judgeEnabled: boolean;
  status: BenchStatus;
}) {
  const progress = new Map(props.runs.map(run => [benchRunKey(run), run]));
  const results = new Map(props.results?.map(run => [benchRunKey(run), run]));
  return props.groups.filter(group => group.enabled).map(group => {
    const runs = props.scenarios.flatMap(scenario =>
      Array.from({ length: props.repeats }, (_, index) => {
        const identity = {
          groupId: group.id,
          scenarioId: scenario.id,
          repeatIndex: index + 1,
        };
        const key = benchRunKey(identity);
        return {
          key,
          scenario,
          run: resolveBenchRunProgress(
            identity,
            progress.get(key),
            results.get(key),
            props.status,
            props.judgeEnabled,
          ),
        };
      })
    );
    const finished = runs.filter(({ run }) =>
      ['complete', 'failed', 'cancelled'].includes(run.phase)
    ).length;
    return (
      <details className='benchWorkflowGroup' key={group.id} open>
        <summary>
          <strong title={group.name}>{group.name}</strong>
          <span>{finished} / {runs.length} finished</span>
        </summary>
        <ol className='benchWorkflowRuns'>
          {runs.map(({ key, scenario, run }) => (
            <li className='benchWorkflowRun' key={key} data-phase={run.phase}>
              <div className='benchWorkflowRunHeading'>
                <span title={scenario.name}>
                  {scenario.name} <small>#{run.repeatIndex}</small>
                </span>
                <strong>{PHASE_LABELS[run.phase] ?? 'Not recorded'}</strong>
              </div>
              <ol
                className='benchWorkflowStages'
                aria-label={`${scenario.name} #${run.repeatIndex} workflow`}
              >
                {STAGES.map(([stage, label]) => (
                  <li key={stage} data-status={run[stage]}>
                    <span>{label}</span>
                    <strong>{STAGE_LABELS[run[stage]]}</strong>
                  </li>
                ))}
              </ol>
              {run.error && <p className='benchWorkflowError'>{run.error}</p>}
            </li>
          ))}
        </ol>
      </details>
    );
  });
}
