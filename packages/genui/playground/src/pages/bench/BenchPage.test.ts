// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BenchComparisonGroupsSection } from './BenchComparisonGroupsSection.js';
import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
} from './benchData.js';
import {
  BenchPage,
  createBenchJobCancellationRequestInit,
  getBenchJobCancellationDisposition,
  getBenchRunBlockers,
  getBenchRunMessageText,
  migrateBenchHistoryEntries,
  normalizeBenchUiJudgeServerUrl,
  readBenchHistory,
  readBenchUiJudgeServerUrl,
  saveBenchHistoryEntry,
  serializeBenchHistoryEntries,
  serializeBenchReport,
  shouldApplyBenchReportRequest,
  shouldCancelCreatedBenchJob,
  updateBenchGroupById,
  upsertBenchHistoryEntry,
} from './BenchPage.js';
import { getRunButtonText, isBenchRunPlanComplete } from './BenchRunFooter.js';
import { BenchRunPanel } from './BenchRunPanel.js';
import { BenchScenarioSection } from './BenchScenarioSection.js';

// Rstest compiles standalone TSX imports with the classic JSX runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const noop = () => undefined;

function createCompletedHistoryEntry(id: string, jobId: string) {
  return {
    id,
    title: id,
    savedAt: '2026-09-04T00:00:00.000Z',
    report: {
      id: 'shared-report-id',
      jobId,
      createdAt: '2026-09-04T00:00:00.000Z',
      env: { apiKeyConfigured: false, model: 'test-model' },
      settings: {},
      groups: [],
      scenarios: [],
      summaries: [],
      results: [],
    },
    config: {
      env: { apiKeyConfigured: false, model: 'test-model' },
      settings: {},
      groups: [],
      scenarios: [],
    },
  };
}

describe('BenchPage', () => {
  test('renders one English page with history and a new Bench workflow', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchPage),
    );

    expect(markup).toContain('Bench Runner');
    expect(markup).toContain(
      'Combine Protocol, Model, Prompt, and Catalog freely',
    );
    expect(markup).toContain('Choose scenarios');
    expect(markup).toContain('Weather Refresh Card');
    expect(markup).toContain('Product Purchase Card');
    expect(markup).toContain('Kyoto Trip Planner');
    expect(markup).toContain('Add custom scenario');
    expect(markup).toContain('Create comparison groups');
    expect(markup).toContain('Protocol');
    expect(markup).toContain('Model');
    expect(markup).toContain('Prompt');
    expect(markup).toContain('Configure and run');
    expect(markup).toContain('UI_JUDGE_SERVER_URL');
    expect(markup).toContain('A2UI');
    expect(markup).toContain('Start run');
    expect(markup).toContain('class="benchWorkflowScroll"');
    expect(markup).toContain('benchPlanSection benchSetupSection');
    expect(markup).toContain('benchPlanSection benchGroupsSection');
    expect(markup).toContain('benchPlanSection benchRunSection');
    expect(markup).not.toContain('benchOverviewBand');
    expect(markup).toContain('class="benchRunFooter"');
    expect(markup).toContain('class="benchPlanSummary"');
    expect(markup.indexOf('class="benchRunFooter"')).toBeGreaterThan(
      markup.indexOf('class="benchWorkflowScroll"'),
    );
    expect(markup).not.toContain('class="benchProgressTrack"');
    expect(markup).toContain('New Bench');
    expect(markup).toContain('History');
    expect(markup).not.toContain('href="#/bench/history"');
    expect(markup).not.toContain('More settings');
    expect(markup).not.toContain('Scenario type');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('Variant matrix');
    expect(markup).not.toContain('Protocol pair');
    expect(markup).not.toContain('Phase 01');
    expect(markup).not.toContain('Phase 02');
    expect(markup).not.toContain('A2UI Bench');
    expect(markup).not.toContain('phase-2-runner');
    expect(markup).not.toMatch(/[\u3400-\u9fff]/u);
  });

  test('keeps history inline instead of exposing a separate view', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BenchPage),
    );

    expect(markup).toContain('New Bench');
    expect(markup).toContain('History');
    expect(markup).toContain('Completed runs will appear here');
    expect(markup).not.toContain('Back to Runner');
    expect(markup).not.toContain('Bench sections');
  });

  test('keeps historical Bench content selectable while controls are read-only', () => {
    const scenarioMarkup = renderToStaticMarkup(
      React.createElement(BenchScenarioSection, {
        locked: true,
        onAdd: noop,
        onNameChange: noop,
        onPromptChange: noop,
        onRemove: noop,
        scenarios: DEFAULT_BENCH_SCENARIOS,
      }),
    );
    const groupMarkup = renderToStaticMarkup(
      React.createElement(BenchComparisonGroupsSection, {
        catalogOptions: ['Full Catalog'],
        groups: createDefaultBenchGroups('test-model'),
        locked: true,
        modelOptions: [],
        onAdd: noop,
        onCatalogChange: noop,
        onEnabledChange: noop,
        onModelChange: noop,
        onNameChange: noop,
        onProfileChange: noop,
        onPromptChange: noop,
        onProtocolChange: noop,
        onRemove: noop,
        onRoleChange: noop,
      }),
    );
    const runMarkup = renderToStaticMarkup(
      React.createElement(BenchRunPanel, {
        locked: true,
        onSettingsChange: noop,
        onUiJudgeServerUrlChange: noop,
        settings: DEFAULT_BENCH_SETTINGS,
        uiJudgeServerUrl: 'http://judge.test/',
      }),
    );
    const markup = scenarioMarkup + groupMarkup + runMarkup;

    expect(markup).not.toContain('inert=""');
    expect(markup).toContain('data-read-only="true"');
    expect(markup).toContain('readOnly=""');
    expect(markup).toContain('disabled=""');
  });

  test('configures models per comparison group instead of in the run section', () => {
    const baseline = createDefaultBenchGroups('test-model')[0];
    if (!baseline) throw new Error('Expected a default Bench group');
    const groupMarkup = renderToStaticMarkup(
      React.createElement(BenchComparisonGroupsSection, {
        catalogOptions: ['Full Catalog'],
        groups: [
          baseline,
          {
            ...baseline,
            id: 'model-comparison',
            role: 'experiment',
            name: 'Model comparison',
            variable: 'model',
            model: 'other-model',
          },
        ],
        locked: false,
        modelOptions: [
          { id: 'test-model', label: 'Test model' },
          { id: 'other-model', label: 'Other model' },
        ],
        onAdd: noop,
        onCatalogChange: noop,
        onEnabledChange: noop,
        onModelChange: noop,
        onNameChange: noop,
        onProfileChange: noop,
        onPromptChange: noop,
        onProtocolChange: noop,
        onRemove: noop,
        onRoleChange: noop,
      }),
    );
    const runMarkup = renderToStaticMarkup(
      React.createElement(BenchRunPanel, {
        locked: false,
        onSettingsChange: noop,
        onUiJudgeServerUrlChange: noop,
        settings: DEFAULT_BENCH_SETTINGS,
        uiJudgeServerUrl: '',
      }),
    );

    expect(groupMarkup).not.toContain('Provider connection');
    expect(groupMarkup).not.toContain('Custom API key');
    expect(groupMarkup).toContain('Baseline Model');
    expect(groupMarkup).toContain('Model comparison Model');
    expect(groupMarkup).toContain('Test model');
    expect(groupMarkup).toContain('Other model');
    expect(groupMarkup).not.toContain('Custom model');
    expect(runMarkup).not.toContain('Provider');
    expect(runMarkup).not.toContain('Model');
  });

  test('updates each comparison group model independently', () => {
    const baseline = createDefaultBenchGroups('baseline-model')[0];
    if (!baseline) throw new Error('Expected a default Bench group');
    const comparison = {
      ...baseline,
      id: 'comparison',
      role: 'experiment' as const,
      model: 'comparison-model',
    };

    const updated = updateBenchGroupById(
      [baseline, comparison],
      comparison.id,
      { model: 'updated-model' },
    );

    expect(updated.map((group) => group.model)).toEqual([
      'baseline-model',
      'updated-model',
    ]);
    expect(baseline.model).toBe('baseline-model');
  });

  test('renders server-provided run status text', () => {
    const userText = { code: 'raw', text: 'Custom status' } as const;
    expect(getBenchRunMessageText(userText)).toBe('Custom status');
  });

  test('uses start and pause actions for a Bench run', () => {
    expect(getRunButtonText('idle')).toBe('Start run');
    expect(getRunButtonText('running')).toBe('Pause');
    expect(getRunButtonText('cancelled')).toBe('Start run');
    expect(getBenchRunMessageText({ code: 'bench-cancelled' }))
      .toBe('Bench paused');
  });

  test('disables starting when any plan summary item is empty', () => {
    expect(isBenchRunPlanComplete(['a2ui'], 1, 3, 9)).toBe(true);
    expect(isBenchRunPlanComplete([], 1, 3, 9)).toBe(false);
    expect(isBenchRunPlanComplete(['a2ui'], 0, 3, 9)).toBe(false);
    expect(isBenchRunPlanComplete(['a2ui'], 1, 0, 9)).toBe(false);
    expect(isBenchRunPlanComplete(['a2ui'], 1, 3, 0)).toBe(false);
  });

  test('ignores stale and aborted report recovery requests', () => {
    const current = new AbortController();
    const stale = new AbortController();

    expect(shouldApplyBenchReportRequest(current, current)).toBe(true);
    expect(shouldApplyBenchReportRequest(stale, current)).toBe(false);

    current.abort();
    expect(shouldApplyBenchReportRequest(current, current)).toBe(false);
  });

  test('keeps failed job cancellations retryable', () => {
    expect(
      getBenchJobCancellationDisposition({ ok: true, status: 200 }),
    ).toBe('cleared');
    expect(
      getBenchJobCancellationDisposition({ ok: false, status: 404 }),
    ).toBe('cleared');
    expect(
      getBenchJobCancellationDisposition({ ok: false, status: 500 }),
    ).toBe('retry');
    expect(createBenchJobCancellationRequestInit()).toEqual({
      method: 'DELETE',
      keepalive: true,
    });
  });

  test('cancels a job created by a superseded start operation', () => {
    expect(shouldCancelCreatedBenchJob(4, 5)).toBe(true);
    expect(shouldCancelCreatedBenchJob(5, 5)).toBe(false);
  });

  test('requires an enabled control group before running', () => {
    expect(getBenchRunBlockers(1, 0, 1, 1)).toContain(
      'Enable at least one baseline group.',
    );
    expect(getBenchRunBlockers(1, 1, 1, 1)).not.toContain(
      'Enable at least one baseline group.',
    );
  });

  test('validates and restores the UI Judge server URL', () => {
    expect(normalizeBenchUiJudgeServerUrl(
      'http://judge.test/internal?token=ignored#health',
    )).toBe('http://judge.test/internal/');
    expect(normalizeBenchUiJudgeServerUrl('file:///tmp/judge.sock')).toBeNull();
    expect(normalizeBenchUiJudgeServerUrl('https://user@judge.test'))
      .toBeNull();

    const originalWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    );
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => 'http://saved-judge.test/',
        },
      },
    });
    try {
      expect(readBenchUiJudgeServerUrl()).toBe(
        'http://saved-judge.test/',
      );
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });

  test('sanitizes provider details and screenshots from copied reports', () => {
    const serialized = serializeBenchReport({
      env: {
        baseURL: 'https://private-provider.example/v1',
        apiKey: 'secret',
      },
      provider: {
        baseUrl: 'https://alternate-private-provider.example/v1',
      },
      results: [
        {
          screenshotDataUrl: 'data:image/png;base64,private-image',
        },
      ],
      warning: 'retry https://private-provider.example/v1',
    } as never);

    expect(serialized).not.toContain('private-provider');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('private-image');
    expect(serialized).not.toContain('baseURL');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('screenshotDataUrl');
  });

  test('redacts the current provider key from report text', () => {
    const apiKey = 'custom/key+with?chars=42';
    const serialized = serializeBenchReport({
      warnings: [
        `provider rejected ${apiKey}`,
        `provider rejected ${encodeURIComponent(apiKey)}`,
      ],
      summaries: [],
      results: [],
    } as never, [apiKey]);

    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(encodeURIComponent(apiKey));
    expect(serialized).toContain('[redacted credential]');
  });

  test('migrates legacy history into a sanitized persistent shape', () => {
    const legacyHistory = [
      {
        id: 'legacy-entry',
        title: 'Legacy Run',
        savedAt: '2026-07-30T10:00:00.000Z',
        report: {
          id: 'legacy-report',
          createdAt: '2026-07-30T10:00:00.000Z',
          env: {
            apiKeyConfigured: true,
            apiKey: 'legacy-secret',
            baseURL: 'https://private-provider.example/v1',
            model: 'test-model',
          },
          settings: {
            repeats: 1,
            parallelism: 1,
            repairEnabled: true,
            judgeEnabled: true,
            collectLiveRenderMetrics: false,
          },
          groups: [],
          scenarios: [],
          summaries: [],
          results: [
            {
              error: 'Bearer legacy-token',
              screenshotDataUrl: 'data:image/png;base64,private-image',
            },
          ],
        },
        config: {
          env: {
            apiKeyConfigured: true,
            apiKey: 'legacy-secret',
            baseURL: 'https://private-provider.example/v1',
            model: 'test-model',
          },
          settings: {
            repeats: 1,
            parallelism: 1,
            repairEnabled: true,
            judgeEnabled: true,
            collectLiveRenderMetrics: false,
          },
          groups: [],
          scenarios: [],
        },
      },
    ];
    const originalWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    );
    let persisted = '';
    let serialized = '';
    let migratedLength = 0;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => JSON.stringify(legacyHistory),
          setItem: (_key: string, value: string) => {
            persisted = value;
          },
        },
      },
    });
    try {
      const migrated = readBenchHistory();
      migratedLength = migrated.length;
      serialized = serializeBenchHistoryEntries(migrated);
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }

    expect(migratedLength).toBe(1);
    expect(persisted).toBe(serialized);
    expect(serialized).not.toContain('legacy-secret');
    expect(serialized).not.toContain('private-provider');
    expect(serialized).not.toContain('legacy-token');
    expect(serialized).not.toContain('private-image');
    expect(serialized).not.toContain('"apiKey":');
    expect(serialized).not.toContain('baseURL');
    expect(serialized).not.toContain('screenshotDataUrl');
    expect(serialized).toContain('"apiKeyConfigured":true');
  });

  test('retains every completed Bench history entry', () => {
    const history = Array.from({ length: 24 }, (_, index) => ({
      id: `history-${index}`,
      title: `Run ${index}`,
      savedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      report: {
        id: `report-${index}`,
        createdAt: '2026-08-01T00:00:00.000Z',
        env: { apiKeyConfigured: false, model: 'test-model' },
        settings: {},
        groups: [],
        scenarios: [],
        summaries: [],
        results: [],
      },
      config: {
        env: { apiKeyConfigured: false, model: 'test-model' },
        settings: {},
        groups: [],
        scenarios: [],
      },
    }));

    expect(migrateBenchHistoryEntries(history)).toHaveLength(24);
    expect(JSON.parse(serializeBenchHistoryEntries(history as never)))
      .toHaveLength(24);
  });

  test('retains runs with distinct jobs when report ids are reused', () => {
    const first = createCompletedHistoryEntry('history-1', 'job-1');
    const second = createCompletedHistoryEntry('history-2', 'job-2');

    expect(
      upsertBenchHistoryEntry([first, second] as never, {
        ...second,
        id: 'history-2-restored',
      } as never).map((entry) => entry.id),
    ).toEqual(['history-2-restored', 'history-1']);
    expect(
      upsertBenchHistoryEntry([first] as never, second as never).map(
        (entry) => entry.id,
      ),
    ).toEqual(['history-2', 'history-1']);
  });

  test('saves a completed draft without replacing previous history', () => {
    const previous = createCompletedHistoryEntry('history-1', 'job-1');
    const draft = {
      ...createCompletedHistoryEntry('bench-draft-1', 'job-2'),
      report: null,
    };
    const completedDraft = createCompletedHistoryEntry(
      'bench-draft-1',
      'job-2',
    );

    expect(
      saveBenchHistoryEntry(
        [draft, previous] as never,
        completedDraft as never,
      ).map((entry) => `${entry.id}:${entry.report?.jobId ?? 'draft'}`),
    ).toEqual(['bench-draft-1:job-2', 'history-1:job-1']);
  });

  test('retains a new Bench draft before it has a report', () => {
    const draft = {
      id: 'bench-draft-1',
      title: 'New Bench',
      savedAt: '2026-09-04T00:00:00.000Z',
      report: null,
      config: {
        env: { apiKeyConfigured: false, model: 'test-model' },
        settings: {
          repeats: 3,
          parallelism: 1,
          repairEnabled: true,
          judgeEnabled: true,
          collectLiveRenderMetrics: false,
        },
        groups: [],
        scenarios: [],
      },
    };

    const migrated = migrateBenchHistoryEntries([draft]);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.report).toBeNull();
    expect(serializeBenchHistoryEntries(migrated)).toContain(
      '"report":null',
    );
  });
});
