// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import 'fake-indexeddb/auto';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createBenchPresetGroups,
  createDefaultBenchGroups,
} from './benchData.js';
import { BenchPage } from './BenchPage.js';
import {
  buildBenchPlanShareUrl,
  readBenchPlanShare,
} from './benchPlanShare.js';
import type { BenchReport, BenchRunProgress } from './benchReportTypes.js';
import { GENUI_SERVER_URL } from '../../config/genuiServer.js';
import {
  BENCH_SELECTED_REPORT_STORAGE_KEY,
  readBenchHistory,
} from '../../storage/benchRepo.js';
import * as benchRepo from '../../storage/benchRepo.js';
import { getDB } from '../../storage/db.js';
import { parseRouteHash } from '../../utils/appRoute.js';
import * as clipboard from '../../utils/clipboard.js';

const HISTORY_KEY = 'a2ui-bench-history';
const REDACTED_JOB_ID = '[redacted credential]';
const JOB_ID = '059a758e-4cbf-4053-bbe4-9f8cb47f7444';
const OTHER_JOB_ID = '2582f2e3-f735-4399-bf35-e8184dc6a17c';
const REPORT_URL = `${GENUI_SERVER_URL}/a2ui/bench/jobs/${JOB_ID}/report`;
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

function createReport(jobId: string, groupName: string): BenchReport {
  return {
    id: `report-${groupName}`,
    jobId,
    createdAt: '2026-09-04T00:00:00.000Z',
    status: 'complete',
    env: { apiKeyConfigured: false, model: 'test-model' },
    settings: { ...DEFAULT_BENCH_SETTINGS, repeats: 1 },
    groups: createDefaultBenchGroups('test-model').map((group) => ({
      ...group,
      name: groupName,
    })),
    scenarios: DEFAULT_BENCH_SCENARIOS.map((scenario) => ({ ...scenario })),
    results: [],
    summaries: [{
      groupId: 'control-empty',
      groupName,
      role: 'control',
      protocol: 'a2ui',
      avgTokens: 123,
      avgAgentMs: 1000,
      avgAttempts: 1,
      avgJudgeScore: 4,
      avgFmpMs: 0,
      avgTtiMs: 0,
      avgRenderMs: 0,
      judgeRunCount: 1,
    }],
  };
}

function createHistoryEntry(id: string, report: BenchReport) {
  return {
    id,
    title: id,
    savedAt: report.createdAt,
    report,
    config: {
      env: report.env,
      settings: report.settings,
      groups: report.groups,
      scenarios: report.scenarios,
    },
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe('BenchPage report recovery', () => {
  let container: HTMLDivElement;
  let root: Root;
  let requests: { url: string; method: string; body?: string }[];
  let reports: Map<string, BenchReport>;
  let createdJob: { jobId: string } | undefined;

  beforeEach(async () => {
    const db = await getDB();
    await db.clear('benchHistory');
    await db.clear('meta');
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/#/bench');
    requests = [];
    reports = new Map();
    createdJob = undefined;
    // Rstest compiles standalone TSX imports with the classic JSX runtime.
    rstest.stubGlobal('React', React);
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    rstest.stubGlobal(
      'fetch',
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : (input instanceof URL ? input.href : input.url);
        requests.push({
          url,
          method: init?.method ?? 'GET',
          ...(typeof init?.body === 'string' ? { body: init.body } : {}),
        });
        const path = new URL(url, window.location.origin).pathname;
        let payload: unknown;
        if (path === '/models' || path === '/a2ui/models') {
          payload = {
            defaultModel: 'test-model',
            models: [{ id: 'test-model', label: 'Test model' }],
          };
        } else if (path === '/health' || path === '/a2ui/health') {
          payload = { ok: true, status: 'ok' };
        } else if (
          path === '/a2ui/bench/jobs' && init?.method === 'POST' && createdJob
        ) {
          payload = createdJob;
        } else if (reports.has(url)) {
          payload = reports.get(url);
        } else {
          // All requests stay local, including requests caused by a regression.
          return Promise.resolve(
            jsonResponse({ error: 'Unexpected request' }, 404),
          );
        }
        return Promise.resolve(jsonResponse(payload));
      },
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await React.act(async () => root.unmount());
    container.remove();
    rstest.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    rstest.unstubAllGlobals();
  });

  async function mountPage(sharedPlan?: string) {
    await React.act(async () =>
      root.render(React.createElement(BenchPage, { sharedPlan }))
    );
    await rstest.waitFor(async () => {
      await React.act(async () => {
        await readBenchHistory();
      });
      expect(container.textContent).not.toContain('Loading Bench history…');
    });
  }

  function benchRequests() {
    return requests.filter(({ url }) =>
      new URL(url, window.location.origin).pathname.startsWith(
        '/a2ui/bench/jobs',
      )
    );
  }

  function reportText() {
    return container.querySelector('[aria-label="Bench Report"]')?.textContent;
  }

  test('imports parameters as an editable draft, preserves existing history, and submits only after Start run', async () => {
    const old = createHistoryEntry(
      'Existing report',
      createReport(JOB_ID, 'Old group'),
    );
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([old]));
    const plan = {
      title: 'Shared plan',
      uiJudgeServerUrl: 'https://shared-judge.example.com/capture/',
      groups: createDefaultBenchGroups('test-model').map(group => ({
        ...group,
        name: 'Shared group',
        enableDesignGuidance: false,
        protocol: 'lynx-xml' as const,
        catalog: 'none',
        enableHtmlFragment: true,
        extraInstruction: 'Use compact spacing',
      })),
      scenarios: [{ ...DEFAULT_BENCH_SCENARIOS[0]!, prompt: '显示天气 🌤' }],
      settings: {
        ...DEFAULT_BENCH_SETTINGS,
        judgeEnabled: false,
        repeats: 3,
        repairEnabled: false,
      },
    };
    const url = new URL(buildBenchPlanShareUrl(window.location.href, plan));
    window.localStorage.setItem(
      'genui-bench-ui-judge-server-url',
      'http://localhost:9999/',
    );
    window.history.replaceState(null, '', url);
    await mountPage(parseRouteHash(url.hash).benchPlan);
    await rstest.waitFor(async () => {
      const entries = await readBenchHistory();
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        title: plan.title,
        report: null,
        config: {
          groups: plan.groups,
          scenarios: plan.scenarios,
          settings: plan.settings,
        },
      });
      expect(entries[1]?.report).toEqual(old.report);
      expect(window.location.hash).toBe('#/bench');
    });
    expect(benchRequests()).toHaveLength(0);
    expect(
      container.querySelector<HTMLInputElement>('input[type="url"]')?.value,
    )
      .toBe(plan.uiJudgeServerUrl);
    expect(window.localStorage.getItem('genui-bench-ui-judge-server-url'))
      .toBe(plan.uiJudgeServerUrl);
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Scenario name"]')
        ?.readOnly,
    ).toBe(false);
    const importedHistory = await readBenchHistory();
    const draftId = importedHistory[0]!.id;
    await React.act(async () => root.unmount());
    root = createRoot(container);
    await mountPage();
    const reloadedHistory = await readBenchHistory();
    expect(
      container.querySelector<HTMLInputElement>('input[type="url"]')?.value,
    )
      .toBe(plan.uiJudgeServerUrl);
    expect(reloadedHistory[0]!.id).toBe(draftId);
    expect(reloadedHistory).toHaveLength(2);
    const start = [...container.querySelectorAll('button')].find(button =>
      button.textContent === 'Start run'
    )!;
    await React.act(async () => start.click());
    await rstest.waitFor(() => expect(benchRequests()).toHaveLength(1));
    const body = JSON.parse(benchRequests()[0]!.body!) as {
      groups: unknown;
      scenarios: unknown;
      settings: unknown;
    };
    expect(body.groups).toMatchObject(plan.groups);
    expect(body.scenarios).toEqual(plan.scenarios);
    expect(body.settings).toMatchObject({
      repeats: 3,
      judgeEnabled: false,
      repairEnabled: false,
      maxRepairAttempts: 0,
    });
  });

  test('shares an inactive history plan without switching selection, report data, or model requests', async () => {
    const entry = createHistoryEntry(
      'Completed plan',
      createReport(REDACTED_JOB_ID, 'Saved group'),
    );
    const activeEntry = {
      ...createHistoryEntry(
        'Active plan',
        createReport(REDACTED_JOB_ID, 'Active group'),
      ),
      savedAt: '2026-09-05T00:00:00.000Z',
    };
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([activeEntry, entry]),
    );
    window.localStorage.setItem(
      'genui-bench-ui-judge-server-url',
      'https://shared-judge.example.com/capture',
    );
    const copy = rstest.spyOn(clipboard, 'copyToClipboard').mockResolvedValue(
      true,
    );
    await mountPage();
    const activeRow = () =>
      container.querySelector('.benchHistoryRailItem[data-active="true"]');
    expect(activeRow()?.textContent).toContain(activeEntry.title);
    expect(
      container.querySelectorAll(
        '.benchHistoryRailItem .historyItemMenuTrigger',
      ),
    )
      .toHaveLength(2);
    expect(container.querySelector('.benchHeader .historyItemMenuTrigger'))
      .toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Actions for Completed plan"]',
    )!;
    expect(trigger.closest('.benchHistoryRailItem')).not.toBe(activeRow());
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Share parameters for Completed plan"]',
    )!;
    expect(button.classList.contains('btn-iconOnly')).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await React.act(async () => button.click());
    expect(copy).toHaveBeenCalledTimes(1);
    const plan = readBenchPlanShare(
      parseRouteHash(new URL(copy.mock.calls[0]![0]).hash).benchPlan!,
    );
    expect(plan).toEqual({
      version: 1,
      title: entry.title,
      uiJudgeServerUrl: 'https://shared-judge.example.com/capture/',
      groups: entry.config.groups,
      scenarios: entry.config.scenarios,
      settings: entry.config.settings,
    });
    expect(benchRequests()).toHaveLength(0);
    expect(activeRow()?.textContent).toContain(activeEntry.title);
    expect(container.textContent).toContain(
      'Parameter link copied for "Completed plan".',
    );
  });

  test.each([undefined, ''])(
    'preserves the local screenshot URL for legacy links and clears it for an explicit empty URL (%s)',
    async uiJudgeServerUrl => {
      const localUrl = 'https://local-judge.example.com/';
      window.localStorage.setItem('genui-bench-ui-judge-server-url', localUrl);
      const url = new URL(buildBenchPlanShareUrl(window.location.href, {
        title: 'Shared plan',
        groups: createDefaultBenchGroups('test-model'),
        scenarios: [DEFAULT_BENCH_SCENARIOS[0]!],
        settings: { ...DEFAULT_BENCH_SETTINGS },
        ...(uiJudgeServerUrl === undefined ? {} : { uiJudgeServerUrl }),
      }));
      await mountPage(parseRouteHash(url.hash).benchPlan);
      expect(
        container.querySelector<HTMLInputElement>('input[type="url"]')?.value,
      )
        .toBe(uiJudgeServerUrl ?? localUrl);
      expect(window.localStorage.getItem('genui-bench-ui-judge-server-url'))
        .toBe(uiJudgeServerUrl === '' ? null : localUrl);
      expect(benchRequests()).toHaveLength(0);
    },
  );

  test('retains unavailable shared models through late loading and reload instead of replacing them', async () => {
    const plan = {
      title: 'Unavailable model',
      groups: createDefaultBenchGroups('missing-model'),
      scenarios: [DEFAULT_BENCH_SCENARIOS[0]!],
      settings: { ...DEFAULT_BENCH_SETTINGS, judgeEnabled: false },
    };
    const url = new URL(buildBenchPlanShareUrl(window.location.href, plan));
    window.history.replaceState(null, '', url);
    await mountPage(parseRouteHash(url.hash).benchPlan);
    await rstest.waitFor(async () => {
      const history = await readBenchHistory();
      expect(history[0]?.config.groups[0]?.model).toBe('missing-model');
    });
    expect(
      container.querySelector('[aria-label="Baseline Model"]')?.textContent,
    ).toBe('missing-model');
    await React.act(async () => root.unmount());
    root = createRoot(container);
    await mountPage();
    expect(
      container.querySelector('[aria-label="Baseline Model"]')?.textContent,
    ).toBe('missing-model');
    const start = [...container.querySelectorAll('button')].find(button =>
      button.textContent === 'Start run'
    )!;
    await React.act(async () => start.click());
    expect(benchRequests()).toHaveLength(0);
    expect(container.textContent).toContain(
      'Select a server model for every enabled comparison group.',
    );
  });

  test('rejects invalid links without restoring a report or modifying history', async () => {
    const entry = createHistoryEntry(
      'Existing report',
      createReport(JOB_ID, 'Existing'),
    );
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    await mountPage('invalid');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'invalid or unsupported',
    );
    expect(benchRequests()).toHaveLength(0);
    const history = await readBenchHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.report).toEqual(entry.report);
  });

  async function editHistoryName(title: string, value: string) {
    const trigger = container.querySelector<HTMLButtonElement>(
      `[aria-label="Actions for ${title}"]`,
    )!;
    await React.act(async () => trigger.click());
    const rename = [...document.querySelectorAll('button')].find((item) =>
      item.getAttribute('aria-label') === `Rename ${title}`
    )!;
    await React.act(async () => rename.click());
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Bench name"]',
    )!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      .set!.call(input, value);
    await React.act(async () =>
      input.dispatchEvent(new Event('input', { bubbles: true }))
    );
    return input;
  }

  test('persists a changed protocol group name and submits the matching configuration', async () => {
    const entry = createHistoryEntry(
      'Draft Bench',
      createReport(JOB_ID, 'Group'),
    );
    const group = createBenchPresetGroups('protocol', 'test-model')[0]!;
    entry.config.groups = [group];
    entry.config.settings = { ...entry.config.settings, judgeEnabled: false };
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ ...entry, report: null }]),
    );
    await mountPage();
    await React.act(async () =>
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Group 01-A2UI Protocol"]',
      )!.click()
    );
    const html = [...container.querySelectorAll<HTMLButtonElement>(
      '.benchDropdownMenu[aria-label="Group 01-A2UI Protocol"] button',
    )].find(button => button.querySelector('span')?.textContent === 'HTML')!;
    await React.act(async () => html.click());
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Comparison group name"]',
      )?.value,
    ).toBe('Group 01-HTML');
    await rstest.waitFor(async () => {
      const history = await readBenchHistory();
      expect(history[0]?.config.groups[0]).toMatchObject({
        id: group.id,
        name: 'Group 01-HTML',
        protocol: 'html',
      });
    });
    await React.act(async () => root.unmount());
    root = createRoot(container);
    await mountPage();
    const start = [...container.querySelectorAll('button')].find(button =>
      button.textContent === 'Start run'
    )!;
    await React.act(async () => start.click());
    await rstest.waitFor(() => expect(benchRequests()).toHaveLength(1));
    const payload = JSON.parse(benchRequests()[0]!.body!) as {
      groups: unknown;
    };
    expect(payload.groups).toMatchObject([{
      id: group.id,
      name: 'Group 01-HTML',
      protocol: 'html',
      catalog: 'none',
    }]);
  });

  test('updates workflow stages from live events and rejects older replayed states', async () => {
    const entry = createHistoryEntry(
      'Draft Bench',
      createReport(JOB_ID, 'Group'),
    );
    const group = {
      ...createBenchPresetGroups('model', 'test-model')[0]!,
      id: 'preset-test-model',
    };
    entry.config.groups = [group];
    entry.config.scenarios = [DEFAULT_BENCH_SCENARIOS[0]!];
    entry.config.settings = { ...entry.config.settings, repeats: 2 };
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ ...entry, report: null }]),
    );
    window.localStorage.setItem(
      'genui-bench-ui-judge-server-url',
      'http://judge.example/',
    );
    createdJob = { jobId: JOB_ID };
    const sources: MockEventSource[] = [];
    class MockEventSource extends EventTarget {
      readyState = 1;
      constructor() {
        super();
        sources.push(this);
      }
      close() {
        this.readyState = 2;
      }
    }
    rstest.stubGlobal('EventSource', MockEventSource);
    await mountPage();
    const start = [...container.querySelectorAll('button')].find(button =>
      button.textContent === 'Start run'
    )!;
    await React.act(async () => start.click());
    await rstest.waitFor(() => expect(sources).toHaveLength(1));
    await React.act(async () =>
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Show run workflow"]',
      )!.click()
    );
    const run: BenchRunProgress = {
      groupId: group.id,
      scenarioId: entry.config.scenarios[0]!.id,
      repeatIndex: 1,
      revision: 1,
      phase: 'agent',
      generation: 'running',
      screenshot: 'pending',
      judge: 'pending',
    };
    async function emit(type: string, data: unknown) {
      await React.act(async () =>
        sources[0]!.dispatchEvent(
          new MessageEvent(type, { data: JSON.stringify(data) }),
        )
      );
    }
    function stages(index = 0) {
      return [...container.querySelectorAll('.benchWorkflowStages')[index]!
        .querySelectorAll('li')].map(item => item.getAttribute('data-status'));
    }
    await emit('run-phase', { runProgress: run });
    expect(stages()).toEqual(['running', 'pending', 'pending']);
    expect(stages(1)).toEqual(['queued', 'pending', 'pending']);
    await emit('run-phase', {
      runProgress: {
        ...run,
        revision: 2,
        phase: 'screenshot',
        generation: 'complete',
        screenshot: 'running',
      },
    });
    expect(stages()).toEqual(['complete', 'running', 'pending']);
    const scoring = {
      ...run,
      revision: 3,
      phase: 'judge',
      generation: 'complete',
      screenshot: 'complete',
      judge: 'running',
    };
    await emit('job', { status: 'running', progress: { runs: [scoring] } });
    expect(stages()).toEqual(['complete', 'complete', 'running']);
    await emit('run-phase', { runProgress: run });
    expect(stages()).toEqual(['complete', 'complete', 'running']);
    await emit('run-complete', {
      runProgress: {
        ...scoring,
        revision: 4,
        phase: 'complete',
        judge: 'complete',
      },
    });
    expect(stages()).toEqual(['complete', 'complete', 'complete']);
    expect(container.querySelector('.benchWorkflowGroup summary')?.textContent)
      .toContain('1 / 2 finished');
  });

  test('persists a completed Bench name across reload without changing its report or plan', async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        createHistoryEntry(
          'Original name',
          createReport(REDACTED_JOB_ID, 'Control'),
        ),
      ]),
    );
    await mountPage();
    const initialHistory = await readBenchHistory();
    const original = initialHistory[0]!;
    const input = await editHistoryName(
      'Original name',
      '  Weather comparison  ',
    );
    await React.act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
        }),
      )
    );
    await rstest.waitFor(async () => {
      expect(await readBenchHistory()).toEqual([{
        ...original,
        title: 'Weather comparison',
        titleIsCustom: true,
      }]);
    });
    await React.act(async () => root.unmount());
    root = createRoot(container);
    await mountPage();
    expect(
      container.querySelector('[aria-label="Actions for Weather comparison"]'),
    )
      .not.toBeNull();
    expect(benchRequests()).toEqual([]);
  });

  test('cancels renaming, rejects empty names, and saves on blur after IME input', async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        createHistoryEntry(
          'Keep this name',
          createReport(REDACTED_JOB_ID, 'Control'),
        ),
      ]),
    );
    await mountPage();
    const cancelled = await editHistoryName('Keep this name', 'Discard this');
    await React.act(async () =>
      cancelled.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        }),
      )
    );
    expect(container.querySelector('[aria-label="Bench name"]')).toBeNull();
    const empty = await editHistoryName('Keep this name', '   ');
    await React.act(async () =>
      empty.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
        }),
      )
    );
    const afterEmpty = await readBenchHistory();
    expect(afterEmpty[0]?.title).toBe('Keep this name');
    const composing = await editHistoryName('Keep this name', '天气对比');
    await React.act(async () =>
      composing.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
        }),
      )
    );
    expect(composing.isConnected).toBe(true);
    const duringComposition = await readBenchHistory();
    expect(duringComposition[0]?.title).toBe('Keep this name');
    await React.act(async () => composing.blur());
    await rstest.waitFor(async () => {
      const afterBlur = await readBenchHistory();
      expect(afterBlur[0]?.title).toBe('天气对比');
    });
  });

  test('removes legacy draft Concurrency and caps comparison groups at eight', async () => {
    const entry = createHistoryEntry(
      'Draft Bench',
      createReport(JOB_ID, 'Baseline'),
    );
    Object.assign(entry.config.settings, { parallelism: 3 });
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ ...entry, report: null }]),
    );
    await mountPage();

    const concurrency = [...container.querySelectorAll('label')]
      .find((label) => label.textContent === 'Concurrency')
      ?.querySelector('input');
    expect(concurrency).toBeUndefined();

    const addGroup = container.querySelector<HTMLButtonElement>(
      '[aria-label="Add comparison group"] button',
    );
    expect(addGroup).not.toBeNull();
    await React.act(async () => addGroup!.click());
    expect(container.querySelectorAll('.benchGroupDetails')).toHaveLength(2);

    for (const protocol of ['OpenUI', 'A2UI', 'Lynx XML']) {
      await React.act(async () =>
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Baseline Protocol"]',
        )!.click()
      );
      const option = [...container.querySelectorAll<HTMLButtonElement>(
        '.benchDropdownMenu[aria-label="Baseline Protocol"] button',
      )].find((button) =>
        button.querySelector('span')?.textContent === protocol
      );
      expect(option).toBeDefined();
      await React.act(async () => option!.click());
      expect(
        container.querySelector('button[aria-label="Baseline Protocol"]')
          ?.textContent,
      ).toBe(protocol);
    }

    await rstest.waitFor(async () => {
      const history = await readBenchHistory();
      expect(history[0]?.report).toBeNull();
      expect(Array.isArray(history[0]?.config.groups)).toBe(true);
    });
    for (let index = 2; index < 8; index++) {
      await React.act(async () => addGroup!.click());
    }
    expect(container.querySelectorAll('.benchGroupDetails')).toHaveLength(8);
    expect(addGroup?.disabled).toBe(true);
    await React.act(async () => addGroup!.click());
    expect(container.querySelectorAll('.benchGroupDetails')).toHaveLength(8);
    await rstest.waitFor(async () => {
      const history = await readBenchHistory();
      expect(history[0]?.config.groups).toHaveLength(8);
      expect(history[0]?.config.settings).not.toHaveProperty('parallelism');
    });
  });

  test('keeps both redacted histories readable without requesting their job IDs', async () => {
    const entries = [
      createHistoryEntry(
        'First saved Bench',
        createReport(REDACTED_JOB_ID, 'First saved result'),
      ),
      createHistoryEntry(
        'Second saved Bench',
        createReport(REDACTED_JOB_ID, 'Second saved result'),
      ),
    ];
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));

    await mountPage();
    const historyButtons = container.querySelectorAll<HTMLButtonElement>(
      '.benchHistoryRailItemMain',
    );
    expect(historyButtons).toHaveLength(2);
    await React.act(async () => historyButtons[0]!.click());

    expect(reportText()).toContain('First saved result');
    expect(container.textContent).toContain('The saved job ID is invalid.');
    expect(benchRequests()).toEqual([]);
    await React.act(async () => historyButtons[1]!.click());

    expect(reportText()).toContain('Second saved result');
    expect(reportText()).not.toContain('First saved result');
    expect(container.textContent).toContain('The saved job ID is invalid.');
    expect(benchRequests()).toEqual([]);
    expect(await readBenchHistory()).toHaveLength(
      2,
    );
  });

  test('shows an invalid legacy link instead of restoring an unrelated valid history', async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        createHistoryEntry(
          'Existing Bench',
          createReport(JOB_ID, 'Unrelated saved result'),
        ),
      ]),
    );
    window.history.replaceState(
      null,
      '',
      `/?a2uiBenchJobId=${encodeURIComponent(REDACTED_JOB_ID)}#/bench`,
    );

    await mountPage();

    expect(container.textContent).toContain(
      'This report link has an invalid job ID.',
    );
    expect(reportText()).not.toContain('Unrelated saved result');
    expect(benchRequests()).toEqual([]);
  });

  test('restores a valid history by fetching the original UUID report URL', async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        createHistoryEntry(
          'Existing Bench',
          createReport(JOB_ID, 'Locally saved result'),
        ),
      ]),
    );
    const remote = createReport(JOB_ID, 'Complete remote result');
    remote.results = [{
      id: 'weather-run',
      groupId: 'control-empty',
      groupName: 'Complete remote result',
      scenarioId: 'weather-refresh',
      scenarioName: 'Weather Refresh Card',
      repeatIndex: 1,
      role: 'control',
      tokens: 123,
      agentMs: 1000,
      attempts: 1,
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      judgeScore: 4,
      screenshotDataUrl: PNG,
    }];
    reports.set(REPORT_URL, remote);

    await mountPage();

    expect(benchRequests()).toEqual([{ url: REPORT_URL, method: 'GET' }]);
    expect(reportText()).toContain('Complete remote result');
    expect(container.textContent).toContain('Complete report loaded');
    expect(await readBenchHistory()).toMatchObject(
      [
        { report: { results: [{ screenshotDataUrl: PNG }] } },
      ],
    );
  });

  test('shows a storage warning without erasing history or blocking the report', async () => {
    const entry = createHistoryEntry(
      'Saved Bench',
      createReport(REDACTED_JOB_ID, 'Saved result'),
    );
    const saved = JSON.stringify([entry]);
    window.localStorage.setItem(HISTORY_KEY, saved);
    rstest.spyOn(benchRepo, 'persistBenchHistory').mockRejectedValue(
      new Error('QuotaExceededError'),
    );
    await mountPage();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'History could not be saved',
    );
    expect(reportText()).toContain('Saved result');
    expect(await readBenchHistory()).toHaveLength(1);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  test('does not expose a separate history details tab action', async () => {
    const entry = createHistoryEntry(
      'Saved Bench',
      createReport(REDACTED_JOB_ID, 'Saved result'),
    );
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    const tab = {
      opener: window as Window | null,
      sessionStorage: { setItem: rstest.fn() },
      location: { replace: rstest.fn() },
    };
    const open = rstest.spyOn(window, 'open').mockReturnValue(
      tab as unknown as Window,
    );
    await mountPage();
    expect(container.querySelector<HTMLButtonElement>(
      '[aria-label="View report details for Saved Bench (opens in a new tab)"]',
    )).toBeNull();
    expect(open).not.toHaveBeenCalled();
    const pane = container.querySelector('[aria-label="Bench Report"]')!;
    expect(
      [...pane.querySelectorAll('button')].some((item) =>
        item.textContent === 'JSON'
      ),
    ).toBe(false);
    await React.act(async () =>
      pane.querySelector<HTMLButtonElement>(
        '[aria-label="View report details (opens in a new tab)"]',
      )!.click()
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(tab.sessionStorage.setItem).toHaveBeenLastCalledWith(
      BENCH_SELECTED_REPORT_STORAGE_KEY,
      entry.id,
    );
  });

  test('does not show a pop-up warning for the removed history details action', async () => {
    const entry = createHistoryEntry(
      'Saved Bench',
      createReport(REDACTED_JOB_ID, 'Saved result'),
    );
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    await mountPage();
    expect(container.querySelector<HTMLButtonElement>(
      '[aria-label="View report details for Saved Bench (opens in a new tab)"]',
    )).toBeNull();
    expect(container.textContent).not.toContain('Allow pop-ups');
  });

  test('loads an explicit legacy hash link before a different saved history', async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        createHistoryEntry(
          'Other Bench',
          createReport(OTHER_JOB_ID, 'Other saved result'),
        ),
      ]),
    );
    window.history.replaceState(null, '', `/#/bench?benchJobId=${JOB_ID}`);
    reports.set(REPORT_URL, createReport(JOB_ID, 'Explicit linked result'));

    await mountPage();

    expect(benchRequests()).toEqual([{ url: REPORT_URL, method: 'GET' }]);
    expect(reportText()).toContain('Explicit linked result');
    expect(reportText()).not.toContain('Other saved result');
    expect(await readBenchHistory()).toHaveLength(
      2,
    );
  });
});
