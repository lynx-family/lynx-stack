// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
} from './benchData.js';
import { BenchHistoryRail } from './BenchHistoryRail.js';
import type { BenchReport } from './benchReportTypes.js';
import {
  getHistoryReport,
  loadPublishedReport,
} from './publishedReportLoader.js';
import { PublishedReportPage } from './PublishedReportPage.js';
import { PublishedReportRoute } from './PublishedReportRoute.js';
import {
  getSelectedBenchReportId,
  readBenchHistory,
} from '../../storage/benchRepo.js';

rstest.mock('../../storage/benchRepo.js', { mock: true });
beforeEach(() => {
  rstest.mocked(readBenchHistory).mockReset();
  rstest.mocked(getSelectedBenchReportId).mockResolvedValue('history');
});

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const JOB_ID = '059a758e-4cbf-4053-bbe4-9f8cb47f7444';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const noop = () => undefined;
function reportFixture(): BenchReport {
  return {
    id: `bench-report-${JOB_ID}`,
    jobId: JOB_ID,
    createdAt: '2026-09-07T09:36:28.049Z',
    completedAt: '2026-09-07T09:36:28.049Z',
    status: 'complete',
    env: { model: 'test-model', apiKeyConfigured: true },
    settings: { ...DEFAULT_BENCH_SETTINGS, repeats: 1 },
    capabilities: {
      agent: 'enabled',
      judge: 'enabled',
      renderMetrics: 'disabled',
    },
    groups: createDefaultBenchGroups('test-model'),
    scenarios: [{ ...DEFAULT_BENCH_SCENARIOS[0]! }],
    summary: {
      totalRuns: 1,
      completedRuns: 1,
      failedRuns: 0,
      successRate: 1,
      avgTokens: 11408,
      avgAgentMs: 10838,
      avgAttempts: 1,
    },
    results: [{
      id: 'weather-run-1',
      groupId: 'control-empty',
      groupName: 'Baseline',
      scenarioId: 'weather-refresh',
      scenarioName: 'Weather Refresh Card',
      repeatIndex: 1,
      role: 'control',
      protocol: 'a2ui',
      status: 'complete',
      ok: true,
      tokens: 11408,
      agentMs: 10838,
      attempts: 1,
      judgeScore: 4,
      judgeStatus: 'complete',
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      screenshotDataUrl: PNG,
    }],
    summaries: [{
      groupId: 'control-empty',
      groupName: 'Baseline',
      role: 'control',
      protocol: 'a2ui',
      avgTokens: 11408,
      avgAgentMs: 10838,
      avgAttempts: 1,
      avgJudgeScore: 4,
      avgFmpMs: 0,
      avgTtiMs: 0,
      avgRenderMs: 0,
      judgeRunCount: 1,
      avgJudgeGeqiScore: 63.5,
    }],
    warnings: [],
  };
}

function historyEntry(report = reportFixture()) {
  return {
    id: 'history',
    title: 'History result',
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

afterEach(() => {
  rstest.unstubAllGlobals();
});

describe('local historical Bench reports', () => {
  test('reads the matching saved snapshot without fetching', async () => {
    const entry = historyEntry();
    rstest.mocked(readBenchHistory).mockResolvedValue([entry]);
    const fetch = rstest.fn();
    rstest.stubGlobal('window', { fetch });
    expect(await loadPublishedReport(JOB_ID)).toEqual(entry.report);
    expect(fetch).not.toHaveBeenCalled();
    expect(await loadPublishedReport('')).toEqual(entry.report);
  });

  test('fills old report configuration from the same history entry without changing measurements', () => {
    const entry = historyEntry();
    const original = JSON.stringify(entry);
    const report = getHistoryReport({
      ...entry,
      report: {
        ...entry.report,
        groups: undefined,
        scenarios: undefined,
        env: { model: 'test-model' },
        settings: { repeats: 1, renderMetricsEnabled: false },
      },
    });
    expect(report.groups).toEqual(entry.config.groups);
    expect(report.scenarios).toEqual(entry.config.scenarios);
    expect(report.settings.collectLiveRenderMetrics).toBe(false);
    expect(report.results).toEqual(entry.report.results);
    expect(report.summaries).toBe(entry.report.summaries);
    expect(JSON.stringify(entry)).toBe(original);
  });

  test('keeps public identities intact when reading local metrics', async () => {
    const entry = historyEntry();
    const id = 'experiment-model-with-a-long-public-identifier';
    entry.report.groups[0]!.id = id;
    entry.report.summaries[0]!.groupId = id;
    entry.report.results[0]!.groupId = id;
    rstest.mocked(readBenchHistory).mockResolvedValue([entry]);
    const report = await loadPublishedReport(JOB_ID);
    expect(report.groups[0]!.id).toBe(id);
    expect(report.summaries[0]!.groupId).toBe(id);
    expect(report.results[0]!.groupId).toBe(id);
  });

  test('recovers public model names only from the same cached comparison group', () => {
    const entry = historyEntry();
    entry.config.groups = [
      { ...entry.config.groups[0]!, id: 'other', model: 'different-model' },
      { ...entry.config.groups[0]!, model: 'doubao-evolving-medium' },
    ];
    entry.report.groups[0]!.model = '[REDACTED]';
    entry.report.results[0]!.model = '[redacted credential]';
    const original = JSON.stringify(entry);
    const report = getHistoryReport(entry);
    expect(report.groups[0]!.model).toBe('doubao-evolving-medium');
    expect(report.results[0]!.model).toBe('doubao-evolving-medium');
    const markup = renderToStaticMarkup(
      React.createElement(PublishedReportPage, { report }),
    );
    expect(markup).toContain('doubao-evolving-medium');
    expect(markup).not.toContain('[REDACTED]');
    expect(JSON.stringify(entry)).toBe(original);
    entry.config.groups = [];
    expect(getHistoryReport(entry).groups[0]!.model).toBe(
      'Model name unavailable',
    );
  });

  test.each([
    '../private',
    'a2ui-comparisons',
    '2026-07-30-matched-core',
    '[redacted credential]',
  ])(
    'rejects invalid local handles without reading another report: %s',
    async (id) => {
      await expect(loadPublishedReport(id)).rejects.toThrow(
        'Only reports saved in this browser',
      );
      expect(readBenchHistory).not.toHaveBeenCalled();
    },
  );

  test('explains missing local records', async () => {
    rstest.mocked(readBenchHistory).mockResolvedValue([]);
    await expect(loadPublishedReport(JOB_ID)).rejects.toThrow(
      'not found in this browser',
    );
  });

  test('reports a database read failure', async () => {
    rstest.mocked(readBenchHistory).mockRejectedValue(
      new Error('Local Bench history could not be read.'),
    );
    await expect(loadPublishedReport(JOB_ID)).rejects.toThrow(
      'could not be read',
    );
  });
});

describe('fixed read-only report template', () => {
  test('opens all plan and run details by default', () => {
    const report = reportFixture();
    const markup = renderToStaticMarkup(
      React.createElement(PublishedReportPage, { report }),
    );
    const disclosures = markup.match(/<details[^>]*>/gu) ?? [];
    expect(disclosures).toHaveLength(
      report.scenarios.length + report.groups.length + report.results.length,
    );
    expect(disclosures.every((tag) => tag.includes('open=""'))).toBe(true);
  });
  test.each([
    'https://tracker.example.test/image.png',
    'blob:https://example.test/image',
    'data:image/svg+xml,<svg/>',
    'data:image/png;base64,invalid',
  ])('does not render untrusted images from local data: %s', (url) => {
    const report = reportFixture();
    report.results[0]!.screenshotDataUrl = url;
    const html = renderToStaticMarkup(
      React.createElement(PublishedReportPage, { report }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('No screenshots were saved');
    expect(html).toContain('11,408');
  });
  test('renders recorded results without runner controls or archived reports', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublishedReportPage, { report: reportFixture() }),
    );
    for (
      const text of [
        'Overview',
        'Recorded plan',
        'Run evidence',
        'Weather Refresh Card',
        '11,408',
        '4 / 5',
        '63.5 / 100',
        'zero values do not represent measured FMP',
      ]
    ) expect(html).toContain(text);
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain('View screenshots (1)');
    expect(html).not.toMatch(
      /<input|<textarea|Start run|New Bench|2026-07-30-matched-core|a2ui-comparisons/u,
    );
  });

  test('uses the same sections for OpenUI failures and unevaluated Judge scores', () => {
    const report = reportFixture();
    report.groups[0]!.protocol = 'openui';
    report.groups[0]!.name = 'OpenUI variant';
    report.results[0]!.status = 'failed';
    report.results[0]!.judgeStatus = 'failed';
    report.results[0]!.errors = ['UI Judge rejected the image'];
    report.summaries[0]!.judgeRunCount = 0;
    const html = renderToStaticMarkup(
      React.createElement(PublishedReportPage, { report }),
    );
    expect(html).toContain('OpenUI variant');
    expect(html).toContain('UI Judge rejected the image');
    expect(html).toContain('Not evaluated');
    expect(html).not.toContain('63.5 / 100');
    expect(html.match(/class="publishedReportSection"/gu)).toHaveLength(3);
  });

  test('displays empty results explicitly', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublishedReportPage, {
        report: { ...reportFixture(), results: [], summaries: [] },
      }),
    );
    expect(html).toContain('No run results were recorded.');
    expect(html).toContain('No group summaries were recorded.');
  });

  test('explains that standalone reports require local history', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublishedReportRoute, { reportId: JOB_ID }),
    );
    expect(html).toContain('browser that saved the Bench history');
    expect(html).toContain('Link-based sharing is not enabled');
    expect(html).not.toContain('View local report');
  });

  test('enables local report viewing for reports, including old redacted IDs, but not drafts', () => {
    const entry = historyEntry();
    const render = (report: BenchReport | null) =>
      renderToStaticMarkup(React.createElement(BenchHistoryRail, {
        activeId: null,
        disabled: false,
        entries: [{ ...entry, report }],
        onClear: noop,
        onOpenReport: noop,
        onDelete: noop,
        onNew: noop,
        onRestore: noop,
      }));
    expect(render(entry.report)).toContain(
      'aria-label="View report details for History result (opens in a new tab)"',
    );
    expect(render(entry.report)).not.toMatch(
      /disabled=""[^>]*aria-label="View report details/u,
    );
    expect(render({ ...entry.report, jobId: '[redacted credential]' })).not
      .toMatch(/disabled=""[^>]*aria-label="View report details/u);
    expect(render(null)).toMatch(
      /disabled=""[^>]*aria-label="View report details/u,
    );
  });
});
