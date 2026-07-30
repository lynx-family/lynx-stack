// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from '@rstest/core';

import { PHASE_TWO_PUBLISHED_REPORT } from './phaseTwoPublishedReport.js';

const METRIC_KEYS: readonly string[] = [
  'plannedRuns',
  'runCount',
  'completedRuns',
  'failedRuns',
  'passAt1Runs',
  'passAt1Rate',
  'finalValidRuns',
  'finalValidRate',
  'renderEnabledPlannedRuns',
  'renderEvaluatedRuns',
  'renderPassedRuns',
  'renderCoverageRate',
  'renderPassRate',
  'judgeEnabledPlannedRuns',
  'judgeEvaluatedRuns',
  'judgePassedRuns',
  'judgeCoverageRate',
  'judgeScoreTotal',
  'avgJudgeScoreAllRuns',
  'attemptsTotal',
  'avgAttemptsAllRuns',
  'tokensTotal',
  'avgTokensAllRuns',
  'generationMsTotal',
  'avgGenerationMsAllRuns',
];

function expectAllowedKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);

  expect(keys.filter((key) => !allowed.has(key))).toEqual([]);
  expect(keys).toEqual(expect.arrayContaining(required));
}

describe('published Phase 2 benchmark artifact', () => {
  it('publishes the complete canonical matched-core run', () => {
    expect(PHASE_TWO_PUBLISHED_REPORT).toMatchObject({
      larkUrl:
        'https://bytedance.larkoffice.com/docx/E6xPdVshBoV4bkxHGdwc5SoTnub',
      scope: {
        completeReportCount: 1,
        failedRuns: 0,
        modelCount: 1,
        pairCount: 30,
        plannedRuns: 60,
        reportCount: 1,
        runCount: 60,
        scenarioCount: 3,
      },
      summary: {
        finalValidRate: 1,
        judgeCoverageRate: 1,
        passAt1Rate: 1,
      },
      warnings: [],
    });
    expect(
      PHASE_TWO_PUBLISHED_REPORT.pairs.every((pair) => pair.complete),
    ).toBe(true);
  });

  it('publishes only the sampled repeat-1 screenshot assets', () => {
    const screenshots = PHASE_TWO_PUBLISHED_REPORT.pairs.flatMap((pair) =>
      (['a2ui', 'openui'] as const).flatMap((protocol) => {
        const screenshotUrl = pair.runs[protocol]?.screenshotUrl;
        return screenshotUrl
          ? [{
            protocol,
            repeatIndex: pair.repeatIndex,
            scenarioId: pair.scenarioId,
            screenshotUrl,
          }]
          : [];
      })
    );

    expect(screenshots).toHaveLength(6);
    expect(screenshots.every((item) => item.repeatIndex === 1)).toBe(true);
    expect(new Set(screenshots.map((item) => item.scenarioId)).size).toBe(3);
    expect(new Set(screenshots.map((item) => item.protocol))).toEqual(
      new Set(['a2ui', 'openui']),
    );
  });

  it('preserves the measured quality and efficiency trade-off', () => {
    const a2ui = PHASE_TWO_PUBLISHED_REPORT.modelProtocols.find(
      (item) => item.protocol === 'a2ui',
    );
    const openui = PHASE_TWO_PUBLISHED_REPORT.modelProtocols.find(
      (item) => item.protocol === 'openui',
    );

    expect(a2ui?.metrics.avgJudgeScoreAllRuns).toBeCloseTo(3.0333, 4);
    expect(openui?.metrics.avgJudgeScoreAllRuns).toBeCloseTo(2.2667, 4);
    expect(a2ui?.metrics.avgTokensAllRuns).toBeCloseTo(6609.8667, 4);
    expect(openui?.metrics.avgTokensAllRuns).toBeCloseTo(3161.4333, 4);
    expect(a2ui?.metrics.avgGenerationMsAllRuns).toBeCloseTo(
      29976.7333,
      4,
    );
    expect(openui?.metrics.avgGenerationMsAllRuns).toBeCloseTo(
      19794.1667,
      4,
    );
  });

  it('keeps publication caveats beside the measured data', () => {
    expect(PHASE_TWO_PUBLISHED_REPORT.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('3 个合成场景'),
        expect.stringContaining('同一模型版本'),
        expect.stringContaining('静态 Lynx 截图'),
        expect.stringContaining('dirty worktree'),
        expect.stringContaining('Render evaluator'),
      ]),
    );
    expect(
      PHASE_TWO_PUBLISHED_REPORT.limitations.filter((limitation) =>
        limitation.includes('Render')
      ),
    ).toEqual([
      '独立 Render evaluator 未启用；本报告不能推导 Render、FMP 或 TTI。',
    ]);
  });

  it('contains only the sanitized publication allow-list', () => {
    expectAllowedKeys(PHASE_TWO_PUBLISHED_REPORT, [
      'schemaVersion',
      'title',
      'larkUrl',
      'sources',
      'scope',
      'summary',
      'models',
      'modelProtocols',
      'scenarios',
      'pairs',
      'methodology',
      'warnings',
      'limitations',
    ]);
    expectAllowedKeys(PHASE_TWO_PUBLISHED_REPORT.scope, [
      'reportCount',
      'completeReportCount',
      'modelCount',
      'scenarioCount',
      'pairCount',
      'plannedRuns',
      'runCount',
      'failedRuns',
    ]);
    expectAllowedKeys(PHASE_TWO_PUBLISHED_REPORT.summary, METRIC_KEYS);
    expectAllowedKeys(PHASE_TWO_PUBLISHED_REPORT.methodology, [
      'modes',
      'capabilityProfiles',
      'protocolVersions',
      'providerApis',
      'judgeModels',
      'repeats',
      'maxAttempts',
      'timeoutMs',
      'renderEnabled',
      'judgeEnabled',
    ]);
    expectAllowedKeys(
      PHASE_TWO_PUBLISHED_REPORT.methodology.protocolVersions,
      ['a2ui', 'openui'],
    );

    for (const source of PHASE_TWO_PUBLISHED_REPORT.sources) {
      expectAllowedKeys(source, [
        'id',
        'jobId',
        'status',
        'createdAt',
        'completedAt',
        'model',
        'plannedRuns',
        'runCount',
        'failedRuns',
      ]);
    }

    for (const model of PHASE_TWO_PUBLISHED_REPORT.models) {
      expectAllowedKeys(model, ['model', 'metrics', 'protocols']);
      expectAllowedKeys(model.metrics, METRIC_KEYS);
      for (const protocol of model.protocols) {
        expectAllowedKeys(protocol, ['protocol', 'metrics']);
        expectAllowedKeys(protocol.metrics, METRIC_KEYS);
      }
    }

    for (const modelProtocol of PHASE_TWO_PUBLISHED_REPORT.modelProtocols) {
      expectAllowedKeys(modelProtocol, [
        'id',
        'model',
        'protocol',
        'metrics',
      ]);
      expectAllowedKeys(modelProtocol.metrics, METRIC_KEYS);
    }

    for (const scenario of PHASE_TWO_PUBLISHED_REPORT.scenarios) {
      expectAllowedKeys(scenario, [
        'id',
        'name',
        'type',
        'complexity',
        'models',
        'metrics',
        'protocols',
        'modelProtocols',
        'warnings',
        'errors',
      ]);
      expectAllowedKeys(scenario.metrics, METRIC_KEYS);
      for (const protocol of scenario.protocols) {
        expectAllowedKeys(protocol, ['protocol', 'metrics']);
        expectAllowedKeys(protocol.metrics, METRIC_KEYS);
      }
      for (const modelProtocol of scenario.modelProtocols) {
        expectAllowedKeys(modelProtocol, [
          'id',
          'model',
          'protocol',
          'metrics',
        ]);
        expectAllowedKeys(modelProtocol.metrics, METRIC_KEYS);
      }
    }

    for (const pair of PHASE_TWO_PUBLISHED_REPORT.pairs) {
      expectAllowedKeys(pair, [
        'id',
        'sourceReportId',
        'pairId',
        'model',
        'scenarioId',
        'scenarioName',
        'repeatIndex',
        'complete',
        'runs',
      ]);
      expectAllowedKeys(pair.runs, ['a2ui', 'openui']);
      for (const protocol of ['a2ui', 'openui'] as const) {
        const run = pair.runs[protocol];
        expect(run).toBeDefined();
        if (!run) continue;
        expectAllowedKeys(
          run,
          [
            'id',
            'orderInPair',
            'protocol',
            'status',
            'passAt1',
            'finalValid',
            'attemptCount',
            'totalTokens',
            'generationMs',
            'render',
            'judge',
            'finalOutputChars',
            'errors',
            'warnings',
          ],
          ['screenshotUrl'],
        );
        expectAllowedKeys(
          run.render,
          ['status', 'durationMs'],
          ['error', 'warnings'],
        );
        expectAllowedKeys(
          run.judge,
          ['status', 'durationMs', 'score', 'model'],
          ['error', 'warnings'],
        );
      }
    }
  });

  it('does not expose raw endpoints, credentials, or source identities', () => {
    const serialized = JSON.stringify(PHASE_TWO_PUBLISHED_REPORT);
    const urls = serialized.match(/https?:\/\/[^"\\]+/g) ?? [];

    expect(PHASE_TWO_PUBLISHED_REPORT.sources).toEqual([
      expect.objectContaining({
        id: 'phase-two-formal-source-1',
        jobId: 'phase-two-formal-2026-07-30',
      }),
    ]);
    expect(urls).toEqual([PHASE_TWO_PUBLISHED_REPORT.larkUrl]);
    expect(serialized).not.toMatch(
      /OPENAI_API_KEY|api[_-]?key|authorization|bearer\s|aidp\.bytedance\.net|\/api\/modelhub\/|baseURLs?|base\s+urls?/i,
    );
    expect(serialized).not.toMatch(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
    expect(serialized).not.toMatch(/screenshotDataUrl|data:image/i);
  });
});
