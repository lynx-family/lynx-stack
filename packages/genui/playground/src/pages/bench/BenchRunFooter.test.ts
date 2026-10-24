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

async function renderResizableFooter() {
  let parentHeight = 800;
  rstest.spyOn(container, 'getBoundingClientRect').mockImplementation(() =>
    ({ height: parentHeight }) as DOMRect
  );
  await React.act(async () =>
    root.render(React.createElement(BenchRunFooter, {
      groupCount: 1,
      scenarioCount: 1,
      runCount: 1,
      protocols: ['a2ui'],
      status: 'complete',
      messageText: 'Complete',
      progress: 100,
      reportAvailable: true,
      readOnly: true,
      onAction: () => undefined,
      workflow: React.createElement('div', null, 'Completed workflow'),
    }))
  );
  expect(container.querySelector('[role="separator"]')).toBeNull();
  await React.act(async () =>
    container.querySelector<HTMLButtonElement>('.benchRunProgressToggle')!
      .click()
  );
  const footer = container.querySelector('footer')!;
  rstest.spyOn(footer, 'getBoundingClientRect').mockImplementation(() =>
    ({ height: Number.parseFloat(footer.style.height) || 300 }) as DOMRect
  );
  return {
    footer,
    handle: container.querySelector<HTMLDivElement>('[role="separator"]')!,
    resizeParent: async (height: number) => {
      parentHeight = height;
      await React.act(async () => window.dispatchEvent(new Event('resize')));
    },
  };
}

async function pointer(
  target: EventTarget,
  type: string,
  clientY: number,
  pointerId = 1,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { button: 0, pointerId, clientY });
  await React.act(async () => target.dispatchEvent(event));
}

test('resizes only the expanded read-only workflow and clamps its height while retaining the run action', async () => {
  const { footer, handle } = await renderResizableFooter();
  expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
  await pointer(handle, 'pointerdown', 500);
  expect(document.body.style.cursor).toBe('row-resize');
  await pointer(window, 'pointermove', 250, 2);
  expect(footer.style.height).toBe('');
  await pointer(window, 'pointermove', 250);
  expect(footer.style.height).toBe('550px');
  expect(container.querySelector('.benchRunWorkflow')?.textContent).toBe(
    'Completed workflow',
  );
  expect(container.querySelector('.benchRunActions')?.textContent).toContain(
    'Start run',
  );
  await pointer(window, 'pointermove', -500);
  expect(footer.style.height).toBe('640px');
  await pointer(window, 'pointerup', -500);
  expect(document.body.style.cursor).toBe('');
  expect(document.body.style.userSelect).toBe('');
  await pointer(window, 'pointermove', 300);
  expect(footer.style.height).toBe('640px');

  await pointer(handle, 'pointerdown', 200);
  await pointer(window, 'pointermove', 800);
  expect(footer.style.height).toBe('180px');
  await pointer(window, 'pointercancel', 800);
  expect(document.body.style.cursor).toBe('');
});

test('supports keyboard resizing, preserves the chosen height when reopened, and fits a smaller viewport', async () => {
  const { footer, resizeParent } = await renderResizableFooter();
  const handle = () =>
    container.querySelector<HTMLDivElement>('[role="separator"]')!;
  const key = async (value: string) => {
    await React.act(async () =>
      handle().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: value,
          bubbles: true,
        }),
      )
    );
  };
  await key('ArrowDown');
  expect(footer.style.height).toBe('276px');
  await key('End');
  expect(footer.style.height).toBe('640px');
  await key('ArrowDown');
  expect(footer.style.height).toBe('616px');
  const toggle = container.querySelector<HTMLButtonElement>(
    '.benchRunProgressToggle',
  )!;
  await React.act(async () => toggle.click());
  expect(footer.style.height).toBe('');
  expect(handle()).toBeNull();
  await React.act(async () => toggle.click());
  expect(footer.style.height).toBe('616px');
  await resizeParent(420);
  expect(footer.style.height).toBe('260px');
  expect(handle().getAttribute('aria-valuemax')).toBe('260');
  await key('Home');
  expect(footer.style.height).toBe('180px');
  await key('ArrowUp');
  expect(footer.style.height).toBe('204px');
  expect(handle().getAttribute('aria-valuenow')).toBe('204');
});

test('restores document styles and stops dragging when the footer unmounts', async () => {
  const { handle } = await renderResizableFooter();
  document.body.style.cursor = 'crosshair';
  document.body.style.userSelect = 'text';
  await pointer(handle, 'pointerdown', 500);
  await React.act(async () => root.render(null));
  expect(document.body.style.cursor).toBe('crosshair');
  expect(document.body.style.userSelect).toBe('text');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
