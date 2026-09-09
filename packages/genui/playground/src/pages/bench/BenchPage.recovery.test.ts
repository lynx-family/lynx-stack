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
  createDefaultBenchGroups,
} from './benchData.js';
import { BenchPage } from './BenchPage.js';
import type { BenchReport } from './benchReportTypes.js';
import { GENUI_SERVER_URL } from '../../config/genuiServer.js';
import {
  BENCH_SELECTED_REPORT_STORAGE_KEY,
  getSelectedBenchReportId,
  readBenchHistory,
} from '../../storage/benchRepo.js';
import * as benchRepo from '../../storage/benchRepo.js';
import { getDB } from '../../storage/db.js';

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
  let requests: { url: string; method: string }[];
  let reports: Map<string, BenchReport>;

  beforeEach(async () => {
    const db = await getDB();
    await db.clear('benchHistory');
    await db.clear('meta');
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/#/bench');
    requests = [];
    reports = new Map();
    // Rstest compiles standalone TSX imports with the classic JSX runtime.
    rstest.stubGlobal('React', React);
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    rstest.stubGlobal(
      'fetch',
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : (input instanceof URL ? input.href : input.url);
        requests.push({ url, method: init?.method ?? 'GET' });
        const path = new URL(url, window.location.origin).pathname;
        let payload: unknown;
        if (path === '/models' || path === '/a2ui/models') {
          payload = {
            defaultModel: 'test-model',
            models: [{ id: 'test-model', label: 'Test model' }],
          };
        } else if (path === '/health' || path === '/a2ui/health') {
          payload = { ok: true };
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

  async function mountPage() {
    await React.act(async () => root.render(React.createElement(BenchPage)));
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

    expect(reportText()).toContain('First saved result');
    expect(container.textContent).toContain('The saved job ID is invalid.');
    expect(benchRequests()).toEqual([]);
    const historyButtons = container.querySelectorAll<HTMLButtonElement>(
      '.benchHistoryRailItemMain',
    );
    expect(historyButtons).toHaveLength(2);
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

  test('opens cached details in an isolated new tab without changing the runner URL', async () => {
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
    const originalUrl = window.location.href;
    const before = requests.length;
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="View report details for Saved Bench (opens in a new tab)"]',
    );
    expect(button).not.toBeNull();
    await React.act(async () => button!.click());
    expect(await getSelectedBenchReportId()).toBe(
      entry.id,
    );
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.sessionStorage.setItem).toHaveBeenCalledWith(
      BENCH_SELECTED_REPORT_STORAGE_KEY,
      entry.id,
    );
    expect(tab.location.replace).toHaveBeenCalledWith(
      `${window.location.origin}/#/bench/reports`,
    );
    expect(window.location.href).toBe(originalUrl);
    expect(requests).toHaveLength(before);
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
    expect(open).toHaveBeenCalledTimes(2);
    expect(tab.sessionStorage.setItem).toHaveBeenLastCalledWith(
      BENCH_SELECTED_REPORT_STORAGE_KEY,
      entry.id,
    );
    expect(window.location.href).toBe(originalUrl);
  });

  test('explains when the browser blocks a report details tab', async () => {
    const entry = createHistoryEntry(
      'Saved Bench',
      createReport(REDACTED_JOB_ID, 'Saved result'),
    );
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    rstest.spyOn(window, 'open').mockReturnValue(null);
    await mountPage();
    await React.act(async () =>
      container.querySelector<HTMLButtonElement>(
        '[aria-label="View report details for Saved Bench (opens in a new tab)"]',
      )!.click()
    );
    expect(container.textContent).toContain('Allow pop-ups');
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
