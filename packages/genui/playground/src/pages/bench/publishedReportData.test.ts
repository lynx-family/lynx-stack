// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from '@rstest/core';

import PUBLISHED_REPORT_FIXTURE from './data/phase-two-published.json';

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
  expect(keys).toEqual(expect.arrayContaining([...required]));
}

describe('published benchmark record', () => {
  it('publishes the complete canonical matched-core run', () => {
    expect(PUBLISHED_REPORT_FIXTURE).toMatchObject({
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
      PUBLISHED_REPORT_FIXTURE.pairs.every((pair) => pair.complete),
    ).toBe(true);
  });

  it('publishes only the sampled repeat-1 screenshot assets', () => {
    const screenshots = PUBLISHED_REPORT_FIXTURE.pairs.flatMap((pair) =>
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
    const a2ui = PUBLISHED_REPORT_FIXTURE.modelProtocols.find(
      (item) => item.protocol === 'a2ui',
    );
    const openui = PUBLISHED_REPORT_FIXTURE.modelProtocols.find(
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
    expect(PUBLISHED_REPORT_FIXTURE.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('three synthetic scenarios'),
        expect.stringContaining('same model version'),
        expect.stringContaining('static Lynx screenshots'),
        expect.stringContaining('dirty worktree'),
        expect.stringContaining('Render evaluator'),
      ]),
    );
    expect(
      PUBLISHED_REPORT_FIXTURE.limitations.filter((limitation) =>
        limitation.includes('Render')
      ),
    ).toEqual([
      'The independent Render evaluator was disabled; this report cannot infer Render, FMP, or TTI.',
    ]);
  });

  it('contains only the sanitized publication allow-list', () => {
    expectAllowedKeys(PUBLISHED_REPORT_FIXTURE, [
      'schemaVersion',
      'title',
      'description',
      'screenshotBasePath',
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
    expectAllowedKeys(PUBLISHED_REPORT_FIXTURE.scope, [
      'reportCount',
      'completeReportCount',
      'modelCount',
      'scenarioCount',
      'pairCount',
      'plannedRuns',
      'runCount',
      'failedRuns',
    ]);
    expectAllowedKeys(PUBLISHED_REPORT_FIXTURE.summary, METRIC_KEYS);
    expectAllowedKeys(PUBLISHED_REPORT_FIXTURE.methodology, [
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
      PUBLISHED_REPORT_FIXTURE.methodology.protocolVersions,
      ['a2ui', 'openui'],
    );

    for (const source of PUBLISHED_REPORT_FIXTURE.sources) {
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

    for (const model of PUBLISHED_REPORT_FIXTURE.models) {
      expectAllowedKeys(model, ['model', 'metrics', 'protocols']);
      expectAllowedKeys(model.metrics, METRIC_KEYS);
      for (const protocol of model.protocols) {
        expectAllowedKeys(protocol, ['protocol', 'metrics']);
        expectAllowedKeys(protocol.metrics, METRIC_KEYS);
      }
    }

    for (const modelProtocol of PUBLISHED_REPORT_FIXTURE.modelProtocols) {
      expectAllowedKeys(modelProtocol, [
        'id',
        'model',
        'protocol',
        'metrics',
      ]);
      expectAllowedKeys(modelProtocol.metrics, METRIC_KEYS);
    }

    for (const scenario of PUBLISHED_REPORT_FIXTURE.scenarios) {
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

    for (const pair of PUBLISHED_REPORT_FIXTURE.pairs) {
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
    const serialized = JSON.stringify(PUBLISHED_REPORT_FIXTURE);
    const urls = serialized.match(/https?:\/\/[^"\\]+/g) ?? [];

    expect(PUBLISHED_REPORT_FIXTURE.sources).toEqual([
      expect.objectContaining({
        id: 'phase-two-formal-source-1',
        jobId: 'phase-two-formal-2026-07-30',
      }),
    ]);
    expect(urls).toEqual([PUBLISHED_REPORT_FIXTURE.larkUrl]);
    expect(serialized).not.toMatch(
      /OPENAI_API_KEY|api[_-]?key|authorization|bearer\s|private-provider|internal-provider|baseURLs?|base\s+urls?/i,
    );
    expect(serialized).not.toMatch(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
    expect(serialized).not.toMatch(/screenshotDataUrl|data:image/i);
  });
});
