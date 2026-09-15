// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import {
  DEFAULT_BENCH_SCENARIOS,
  createDefaultBenchGroups,
} from './benchData.js';
import type { BenchRunProgress } from './benchReportTypes.js';
import { BenchRunFooter } from './BenchRunFooter.js';
import { BenchRunWorkflow } from './BenchRunWorkflow.js';

let root: Root;
let container: HTMLDivElement;
let now = 100;

function timing() {
  return container.querySelector('.benchRunTiming')?.textContent;
}

beforeEach(() => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  rstest.stubGlobal('React', React);
  rstest.useFakeTimers();
  now = 100;
  rstest.spyOn(performance, 'now').mockImplementation(() => now);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  rstest.restoreAllMocks();
  rstest.useRealTimers();
  rstest.unstubAllGlobals();
});

test('ticks from the server elapsed time, freezes at the reported total, and resets for another job', async () => {
  const props: React.ComponentProps<typeof BenchRunFooter> = {
    groupCount: 1,
    messageText: 'Running',
    onAction: () => undefined,
    progress: 0,
    protocols: ['a2ui'],
    readOnly: false,
    reportAvailable: false,
    runCount: 1,
    scenarioCount: 1,
    status: 'running',
    liveTiming: { durationMs: 5000, receivedAtMs: 100 },
  };
  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, props))
  );
  expect(timing()).toBe('Total time 5s');
  now = 3100;
  await React.act(async () => rstest.advanceTimersByTimeAsync(3000));
  expect(timing()).toBe('Total time 8s');

  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, {
      ...props,
      status: 'complete',
      reportAvailable: true,
      durationMs: 13_250,
    }))
  );
  expect(timing()).toBe('Total time 13s');
  now = 30_100;
  await React.act(async () => rstest.advanceTimersByTimeAsync(27_000));
  expect(timing()).toBe('Total time 13s');

  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, {
      ...props,
      liveTiming: { durationMs: 0, receivedAtMs: now },
    }))
  );
  expect(timing()).toBe('Total time 0ms');
});

test('expands all group/case/repeat workflows, updates them independently and stays usable in read-only history', async () => {
  const baseline = createDefaultBenchGroups('test-model')[0]!;
  const groups = [
    { ...baseline, id: 'a', name: 'Baseline' },
    { ...baseline, id: 'b', name: 'Comparison', role: 'experiment' as const },
  ];
  const scenarios = DEFAULT_BENCH_SCENARIOS.slice(0, 2);
  const first: BenchRunProgress = {
    groupId: 'a',
    scenarioId: scenarios[0]!.id,
    repeatIndex: 1,
    revision: 4,
    phase: 'judge',
    generation: 'complete',
    screenshot: 'complete',
    judge: 'running',
  };
  const second: BenchRunProgress = {
    ...first,
    groupId: 'b',
    phase: 'agent',
    generation: 'running',
    screenshot: 'pending',
    judge: 'pending',
  };
  const workflow = (runs: BenchRunProgress[]) =>
    React.createElement(BenchRunWorkflow, {
      groups,
      scenarios,
      repeats: 2,
      runs,
      status: 'running',
      judgeEnabled: true,
    });
  const props: React.ComponentProps<typeof BenchRunFooter> = {
    groupCount: 2,
    scenarioCount: 2,
    runCount: 8,
    protocols: ['a2ui'],
    status: 'running',
    messageText: 'Generating',
    progress: 0,
    reportAvailable: false,
    readOnly: false,
    onAction: () => undefined,
    workflow: workflow([first, second]),
  };
  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, props))
  );
  expect(container.querySelector('.benchRunWorkflow')).toBeNull();
  await React.act(async () =>
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Show run workflow"]',
    )!.click()
  );
  expect(container.querySelectorAll('.benchWorkflowGroup')).toHaveLength(2);
  expect(container.querySelectorAll('.benchWorkflowRun')).toHaveLength(8);
  const rows = () => [...container.querySelectorAll('.benchWorkflowRun')];
  expect(rows()[0]?.textContent).toContain('Scoring');
  expect(rows()[4]?.textContent).toContain('Generating');
  expect(rows()[1]?.textContent).toContain('#2');
  expect(rows()[1]?.getAttribute('data-phase')).toBe('queued');

  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, {
      ...props,
      workflow: workflow([first, {
        ...second,
        phase: 'failed',
        generation: 'failed',
        screenshot: 'skipped',
        judge: 'skipped',
        error: 'Invalid JSON response',
      }]),
    }))
  );
  expect(rows()[0]?.textContent).toContain('Scoring');
  expect(rows()[4]?.textContent).toContain('Invalid JSON response');
  expect(rows()[4]?.querySelectorAll('[data-status="skipped"]')).toHaveLength(
    2,
  );

  await React.act(async () =>
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Hide run workflow"]',
    )!.click()
  );
  expect(container.querySelector('.benchRunWorkflow')).toBeNull();
  await React.act(async () =>
    root.render(
      React.createElement(BenchRunFooter, {
        ...props,
        status: 'complete',
        readOnly: true,
      }),
    )
  );
  await React.act(async () =>
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Show run workflow"]',
    )!.click()
  );
  expect(container.querySelector('.benchRunWorkflow')).not.toBeNull();
  expect(
    container.querySelector<HTMLButtonElement>('.benchRunActions button')
      ?.disabled,
  ).toBe(true);

  await React.act(async () =>
    root.render(
      React.createElement(BenchRunFooter, { ...props, status: 'idle' }),
    )
  );
  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, props))
  );
  expect(container.querySelector('.benchRunWorkflow')).toBeNull();
});
