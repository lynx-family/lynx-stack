// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EMPTY_PHASE_TWO_PUBLISHED_REPORT,
  PHASE_TWO_PUBLISHED_REPORT,
} from './phaseTwoPublishedReport.js';
import {
  PhaseTwoReportPage,
  buildThesis,
  collectFormalScreenshotEvidence,
  combinePublishedMetrics,
  resolveFormalScreenshotAssetUrl,
  summarizePairedOutcomes,
  summarizePublishedSelection,
} from './PhaseTwoReportPage.js';

// Rstest compiles standalone TSX imports with the classic JSX runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  rstest.unstubAllEnvs();
});

type PhaseTwoPublishedReport = typeof PHASE_TWO_PUBLISHED_REPORT;
type PhaseTwoPublishedMetrics = PhaseTwoPublishedReport['summary'];
type PhaseTwoPublishedPair = PhaseTwoPublishedReport['pairs'][number];
type PhaseTwoProtocol = keyof PhaseTwoPublishedPair['runs'];
type PhaseTwoPublishedRun = NonNullable<
  PhaseTwoPublishedPair['runs']['a2ui']
>;

const EMPTY_METRICS: PhaseTwoPublishedMetrics = {
  plannedRuns: 0,
  runCount: 0,
  completedRuns: 0,
  failedRuns: 0,
  passAt1Runs: 0,
  passAt1Rate: 0,
  finalValidRuns: 0,
  finalValidRate: 0,
  renderEnabledPlannedRuns: 0,
  renderEvaluatedRuns: 0,
  renderPassedRuns: 0,
  renderCoverageRate: 0,
  renderPassRate: null,
  judgeEnabledPlannedRuns: 0,
  judgeEvaluatedRuns: 0,
  judgePassedRuns: 0,
  judgeCoverageRate: 0,
  judgeScoreTotal: 0,
  avgJudgeScoreAllRuns: null,
  attemptsTotal: 0,
  avgAttemptsAllRuns: 0,
  tokensTotal: 0,
  avgTokensAllRuns: 0,
  generationMsTotal: 0,
  avgGenerationMsAllRuns: 0,
};

function metrics(
  overrides: Partial<PhaseTwoPublishedMetrics>,
): PhaseTwoPublishedMetrics {
  return { ...EMPTY_METRICS, ...overrides };
}

function publishedRun(
  protocol: PhaseTwoProtocol,
  overrides: Partial<PhaseTwoPublishedRun> = {},
): PhaseTwoPublishedRun {
  return {
    id: `run-${protocol}`,
    orderInPair: protocol === 'a2ui' ? 1 : 2,
    protocol,
    status: 'complete',
    passAt1: true,
    finalValid: true,
    attemptCount: 1,
    totalTokens: 100,
    generationMs: 1_000,
    render: {
      status: 'passed',
      durationMs: 10,
    },
    judge: {
      status: 'passed',
      score: protocol === 'a2ui' ? 4 : 3,
      model: 'gpt-5.5-2026-04-24',
      durationMs: 50,
    },
    finalOutputChars: 100,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

function publishedPair(
  id: string,
  options: {
    a2ui?: Partial<PhaseTwoPublishedRun> | null;
    model?: string;
    openui?: Partial<PhaseTwoPublishedRun> | null;
    scenarioId?: string;
  } = {},
): PhaseTwoPublishedPair {
  const model = options.model ?? 'model-alpha';
  const scenarioId = options.scenarioId ?? 'weather';
  const a2ui = options.a2ui === null
    ? undefined
    : publishedRun('a2ui', {
      id: `${id}-a2ui`,
      ...(options.a2ui ?? {}),
    });
  const openui = options.openui === null
    ? undefined
    : publishedRun('openui', {
      id: `${id}-openui`,
      ...(options.openui ?? {}),
    });
  return {
    id: `report\u0000${id}`,
    sourceReportId: 'report',
    pairId: id,
    model,
    scenarioId,
    scenarioName: scenarioId,
    repeatIndex: 1,
    complete: Boolean(a2ui && openui),
    runs: {
      ...(a2ui ? { a2ui } : {}),
      ...(openui ? { openui } : {}),
    },
  };
}

function publishedFixture(): PhaseTwoPublishedReport {
  const a2ui = metrics({
    plannedRuns: 2,
    runCount: 2,
    completedRuns: 2,
    failedRuns: 0,
    passAt1Runs: 2,
    passAt1Rate: 1,
    finalValidRuns: 2,
    finalValidRate: 1,
    renderEnabledPlannedRuns: 1,
    renderEvaluatedRuns: 1,
    renderPassedRuns: 1,
    renderCoverageRate: 0.5,
    renderPassRate: 1,
    judgeEnabledPlannedRuns: 1,
    judgeEvaluatedRuns: 1,
    judgePassedRuns: 1,
    judgeCoverageRate: 0.5,
    judgeScoreTotal: 4,
    avgJudgeScoreAllRuns: 4,
    attemptsTotal: 2,
    avgAttemptsAllRuns: 1,
    tokensTotal: 200,
    avgTokensAllRuns: 100,
    generationMsTotal: 2_000,
    avgGenerationMsAllRuns: 1_000,
  });
  const openui = metrics({
    plannedRuns: 2,
    runCount: 1,
    completedRuns: 1,
    failedRuns: 1,
    passAt1Runs: 1,
    passAt1Rate: 0.5,
    finalValidRuns: 1,
    finalValidRate: 0.5,
    renderEnabledPlannedRuns: 1,
    renderEvaluatedRuns: 1,
    renderPassedRuns: 1,
    renderCoverageRate: 0.5,
    renderPassRate: 1,
    judgeEnabledPlannedRuns: 1,
    judgeEvaluatedRuns: 1,
    judgePassedRuns: 1,
    judgeCoverageRate: 0.5,
    judgeScoreTotal: 3,
    avgJudgeScoreAllRuns: 3,
    attemptsTotal: 1,
    avgAttemptsAllRuns: 0.5,
    tokensTotal: 80,
    avgTokensAllRuns: 40,
    generationMsTotal: 800,
    avgGenerationMsAllRuns: 400,
  });
  const pairs: PhaseTwoPublishedPair[] = [
    {
      id: 'report\u0000pair-1',
      sourceReportId: 'report',
      pairId: 'pair-1',
      model: 'model-alpha',
      scenarioId: 'weather',
      scenarioName: 'Weather',
      repeatIndex: 1,
      complete: true,
      runs: {
        a2ui: publishedRun('a2ui', {
          warnings: ['repair applied'],
        }),
        openui: publishedRun('openui'),
      },
    },
    {
      id: 'report\u0000pair-2',
      sourceReportId: 'report',
      pairId: 'pair-2',
      model: 'model-alpha',
      scenarioId: 'weather',
      scenarioName: 'Weather',
      repeatIndex: 2,
      complete: false,
      runs: {
        a2ui: publishedRun('a2ui', { id: 'run-a2ui-2' }),
      },
    },
  ];
  const modelProtocols = [
    {
      id: 'model-alpha\u0000a2ui',
      model: 'model-alpha',
      protocol: 'a2ui' as const,
      metrics: a2ui,
    },
    {
      id: 'model-alpha\u0000openui',
      model: 'model-alpha',
      protocol: 'openui' as const,
      metrics: openui,
    },
  ];

  return {
    schemaVersion: 'genui-bench-phase-2/published-v1',
    title: 'Published paired report',
    sources: [],
    scope: {
      reportCount: 1,
      completeReportCount: 1,
      modelCount: 1,
      scenarioCount: 1,
      pairCount: 2,
      plannedRuns: 4,
      runCount: 3,
      failedRuns: 1,
    },
    summary: combinePublishedMetrics([a2ui, openui]),
    models: [{
      model: 'model-alpha',
      metrics: combinePublishedMetrics([a2ui, openui]),
      protocols: [
        { protocol: 'a2ui', metrics: a2ui },
        { protocol: 'openui', metrics: openui },
      ],
    }],
    modelProtocols,
    scenarios: [{
      id: 'weather',
      name: 'Weather',
      type: 'Information',
      complexity: 1,
      models: ['model-alpha'],
      metrics: combinePublishedMetrics([a2ui, openui]),
      protocols: [
        { protocol: 'a2ui', metrics: a2ui },
        { protocol: 'openui', metrics: openui },
      ],
      modelProtocols,
      warnings: ['repair applied'],
      errors: ['missing OpenUI result'],
    }],
    pairs,
    methodology: {
      modes: ['matched-core'],
      capabilityProfiles: ['matched-core-v1'],
      protocolVersions: { a2ui: ['v0.9'], openui: ['v0.5'] },
      providerApis: ['chat'],
      judgeModels: ['gpt-5.5-2026-04-24'],
      repeats: [2],
      maxAttempts: [2],
      timeoutMs: [120_000],
      renderEnabled: [false, true],
      judgeEnabled: [false, true],
    },
    warnings: [],
    limitations: ['Coverage is incomplete.'],
  };
}

describe('Phase 2 report page integration', () => {
  test('preserves published planned and enabled denominators', () => {
    const report = publishedFixture();
    const summary = summarizePublishedSelection(report);

    expect(summary).toMatchObject({
      pairCount: 2,
      completePairs: 1,
      pairCoverageRate: 0.5,
      a2ui: {
        plannedRuns: 2,
        failedRuns: 0,
        avgJudgeScoreAllRuns: 4,
        renderPassRate: 1,
      },
      openui: {
        plannedRuns: 2,
        failedRuns: 1,
        avgJudgeScoreAllRuns: 3,
        renderPassRate: 1,
      },
    });
    expect(report.pairs[1]?.runs.openui).toBeUndefined();
  });

  test('combines metrics with enabled denominators rather than all pair count', () => {
    const report = publishedFixture();
    const combined = combinePublishedMetrics(
      report.modelProtocols.map((item) => item.metrics),
    );

    expect(combined).toMatchObject({
      plannedRuns: 4,
      completedRuns: 3,
      failedRuns: 1,
      renderEnabledPlannedRuns: 2,
      renderPassRate: 1,
      judgeEnabledPlannedRuns: 2,
      judgeScoreTotal: 7,
      avgJudgeScoreAllRuns: 3.5,
      avgTokensAllRuns: 70,
    });
  });

  test('neutralizes the thesis when pair or evaluator coverage is incomplete', () => {
    const summary = summarizePublishedSelection(publishedFixture());

    expect(
      buildThesis(
        summary.a2ui,
        summary.openui,
        summary.pairCount,
        summary.completePairs,
      ),
    ).toContain('不形成协议优劣结论');
  });

  test('counts filtered W/T/L from the A2UI perspective for each metric direction', () => {
    const pairs = [
      publishedPair('alpha-weather', {
        a2ui: {
          judge: {
            status: 'passed',
            score: 4,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 120,
        },
        openui: {
          judge: {
            status: 'passed',
            score: 3,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 80,
        },
      }),
      publishedPair('alpha-product', {
        scenarioId: 'product',
        a2ui: {
          judge: {
            status: 'passed',
            score: 2,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 50,
        },
        openui: {
          judge: {
            status: 'passed',
            score: 3,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 60,
        },
      }),
      publishedPair('beta-weather', {
        model: 'model-beta',
        a2ui: {
          judge: {
            status: 'passed',
            score: 3,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 90,
        },
        openui: {
          judge: {
            status: 'passed',
            score: 3,
            model: 'judge',
            durationMs: 1,
          },
          totalTokens: 90,
        },
      }),
      publishedPair('alpha-weather-missing', {
        openui: null,
      }),
    ];

    expect(
      summarizePairedOutcomes(
        pairs,
        'avgJudgeScoreAllRuns',
        'model-alpha',
        'weather',
      ),
    ).toEqual({
      a2uiLosses: 0,
      a2uiWins: 1,
      comparablePairs: 1,
      ties: 0,
    });
    expect(
      summarizePairedOutcomes(
        pairs,
        'avgTokensAllRuns',
        'model-alpha',
        'weather',
      ),
    ).toEqual({
      a2uiLosses: 1,
      a2uiWins: 0,
      comparablePairs: 1,
      ties: 0,
    });
    expect(
      summarizePairedOutcomes(
        pairs,
        'avgJudgeScoreAllRuns',
        'model-alpha',
        'product',
      ),
    ).toMatchObject({
      a2uiLosses: 1,
      a2uiWins: 0,
      comparablePairs: 1,
      ties: 0,
    });
    expect(
      summarizePairedOutcomes(
        pairs,
        'avgJudgeScoreAllRuns',
        'model-beta',
        'weather',
      ),
    ).toMatchObject({
      a2uiLosses: 0,
      a2uiWins: 0,
      comparablePairs: 1,
      ties: 1,
    });
  });

  test('excludes pairs without two measured values from the comparable count', () => {
    const unavailableJudge = publishedPair('judge-unavailable', {
      a2ui: {
        judge: {
          status: 'failed',
          score: 0,
          model: 'judge',
          durationMs: 1,
        },
        totalTokens: 70,
      },
      openui: {
        totalTokens: 80,
      },
    });

    expect(
      summarizePairedOutcomes(
        [unavailableJudge],
        'avgJudgeScoreAllRuns',
      ).comparablePairs,
    ).toBe(0);
    expect(
      summarizePairedOutcomes(
        [unavailableJudge],
        'avgTokensAllRuns',
      ),
    ).toMatchObject({
      a2uiWins: 1,
      comparablePairs: 1,
    });
  });

  test('derives the checked-in report W/T/L for quality and efficiency metrics', () => {
    expect(
      summarizePairedOutcomes(
        PHASE_TWO_PUBLISHED_REPORT.pairs,
        'avgJudgeScoreAllRuns',
      ),
    ).toEqual({
      a2uiLosses: 1,
      a2uiWins: 19,
      comparablePairs: 30,
      ties: 10,
    });
    expect(
      summarizePairedOutcomes(
        PHASE_TWO_PUBLISHED_REPORT.pairs,
        'avgTokensAllRuns',
      ),
    ).toEqual({
      a2uiLosses: 30,
      a2uiWins: 0,
      comparablePairs: 30,
      ties: 0,
    });
    expect(
      summarizePairedOutcomes(
        PHASE_TWO_PUBLISHED_REPORT.pairs,
        'avgGenerationMsAllRuns',
      ),
    ).toEqual({
      a2uiLosses: 28,
      a2uiWins: 2,
      comparablePairs: 30,
      ties: 0,
    });
  });

  test('renders an explicit empty state instead of a zero-value tie', () => {
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        report: EMPTY_PHASE_TWO_PUBLISHED_REPORT,
      }),
    );

    expect(html).toContain('尚无可发布的 paired evidence');
    expect(html).toContain('此筛选暂无 paired evidence');
    expect(html.match(/role="combobox"/gu)).toHaveLength(2);
    expect(
      html.match(/role="combobox"[^>]*disabled=""/gu),
    ).toHaveLength(2);
    expect(html).not.toContain('本轮持平');
  });

  test('renders pair coverage, diagnostics, and a stable tab panel target', () => {
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, { report: publishedFixture() }),
    );

    expect(html).toContain('1 / 2');
    expect(html).toContain('50% pair coverage');
    expect(html).toContain('A2UI W / T / L');
    expect(html).toContain('1 comparable pairs');
    expect(html).toContain('平均总 Tokens');
    expect(html).toContain('Total Tokens');
    expect(html).toContain('Total token delta');
    expect(html).toContain('缺少计划运行结果');
    expect(html).toContain('repair applied');
    expect(
      html.match(/class="phaseTwoReportSelectControl"/gu),
    ).toHaveLength(2);
    expect(
      html.match(/phaseTwoReportSelectChevron/gu),
    ).toHaveLength(2);
    expect(html.match(/role="combobox"/gu)).toHaveLength(2);
    expect(html.match(/<select/gu)).toHaveLength(2);
    expect(
      html.match(/<select[^>]*aria-hidden="true"[^>]*tabindex="-1"/gu),
    ).toHaveLength(2);
    expect(html).toContain(
      'id="phase-two-report-model-filter-label"',
    );
    expect(html).toContain(
      'id="phase-two-report-model-filter"',
    );
    expect(html).toContain(
      'aria-labelledby="phase-two-report-model-filter-label"',
    );
    expect(html).toContain(
      'id="phase-two-report-scenario-filter-label"',
    );
    expect(html).toContain(
      'id="phase-two-report-scenario-filter"',
    );
    expect(html).toContain(
      'aria-labelledby="phase-two-report-scenario-filter-label"',
    );
    expect(
      html.match(/aria-controls="phase-two-report-metric-panel"/gu),
    ).toHaveLength(6);
    expect(
      html.match(/id="phase-two-report-metric-panel"/gu),
    ).toHaveLength(1);
  });

  test('renders the Phase 2 chrome in explicit Chinese and English locales', () => {
    const report = publishedFixture();
    const chineseHtml = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        locale: 'zh-CN',
        report,
      }),
    );
    const englishHtml = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        locale: 'en-US',
        report,
      }),
    );

    expect(chineseHtml).toContain('结论');
    expect(chineseHtml).toContain('什么是 matched-core？');
    expect(chineseHtml).toContain('缺少计划运行结果');
    expect(chineseHtml).toContain('aria-label="报告筛选条件"');
    expect(chineseHtml).not.toContain('What is matched-core?');

    expect(englishHtml).toContain('Conclusion');
    expect(englishHtml).toContain('What is matched-core?');
    expect(englishHtml).toContain('Same task × model × repeat');
    expect(englishHtml).toContain(
      'Start with the overview, then inspect the delta',
    );
    expect(englishHtml).toContain('Final valid rate');
    expect(englishHtml).toContain('Missing planned run result');
    expect(englishHtml).toContain('aria-label="Report filters"');
    expect(englishHtml).toContain(
      'aria-label="Select a paired metric"',
    );
    expect(englishHtml).toContain('Evaluation methodology');
    expect(englishHtml).toContain(
      'Protocol differences should be grounded in paired evidence',
    );
    expect(englishHtml).not.toMatch(/[\u3400-\u9fff]/u);
  });

  test('localizes the checked-in report limitations without mutating report data', () => {
    const originalLimitation = PHASE_TWO_PUBLISHED_REPORT.limitations[0];
    const chineseHtml = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        locale: 'zh-CN',
      }),
    );
    const englishHtml = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        locale: 'en-US',
      }),
    );

    expect(originalLimitation).toContain('本轮只覆盖 3 个合成场景');
    expect(chineseHtml).toContain(originalLimitation);
    expect(englishHtml).toContain(
      'This run covers only three synthetic scenarios',
    );
    expect(englishHtml).toContain(
      'The independent Render evaluator was disabled',
    );
    expect(englishHtml).not.toMatch(/[\u3400-\u9fff]/u);
    expect(PHASE_TWO_PUBLISHED_REPORT.limitations[0]).toBe(
      originalLimitation,
    );
  });

  test('aligns the Phase 2 identity with Phase 1 and omits document links', () => {
    const report = publishedFixture();
    report.larkUrl = 'https://example.test/phase-two-report';
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, { report }),
    );

    expect(
      html.match(/Lynx A2UI Bench · Phase 02/gu),
    ).toHaveLength(2);
    expect(html).toContain('matched-core paired report');
    expect(html).not.toContain('MATCHED-CORE PAIRED REPORT');
    expect(html).toContain(
      'aria-controls="phase-two-report-matched-core-explainer"',
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('什么是 matched-core？');
    expect(html).toContain('同一 task × model × repeat');
    expect(html).toContain('协议 schema、组件表达和适配 prompt 保持各自实现');
    expect(html).not.toContain('GENUI BENCH / PHASE 02');
    expect(html).not.toContain('打开完整飞书文档');
    expect(html).not.toContain('在飞书中查看完整报告');
    expect(html).not.toContain('#/bench/phase-2-runner');
    expect(html).not.toContain(report.larkUrl);
  });

  test('renders captured Judge screenshots in an accessible dialog', () => {
    rstest.stubEnv('ASSET_PREFIX', '/genui/');
    const report = publishedFixture();
    report.sources = [{
      id: 'report',
      jobId: 'formal-job',
      status: 'complete',
      createdAt: '2026-07-29T00:00:00.000Z',
      completedAt: '2026-07-29T00:01:00.000Z',
      model: 'model-alpha',
      plannedRuns: 4,
      runCount: 3,
      failedRuns: 1,
    }];
    report.limitations = [
      'canonical report 未保存截图或完整协议输出，单个 Judge 分数的产物级回溯仍需补齐。',
    ];
    const pair = report.pairs[0]!;
    pair.runs.a2ui!.screenshotUrl =
      '/bench/phase-two/screenshots/run-a2ui.png?v=20260729T000100000Z';
    Object.assign(pair.runs.a2ui!.judge, {
      summary: 'Weather content is complete.',
    });
    pair.runs.openui!.screenshotUrl =
      '/bench/phase-two/screenshots/run-openui.png?v=20260729T000100000Z';
    report.pairs[1]!.runs.a2ui!.screenshotUrl =
      '/bench/phase-two/screenshots/run-a2ui-2.png?v=20260729T000100000Z';
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        report,
      }),
    );
    const englishHtml = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, {
        locale: 'en-US',
        report,
      }),
    );
    const evidence = collectFormalScreenshotEvidence(report);

    expect(evidence.map((item) => item.id)).toEqual([
      'run-a2ui',
      'run-openui',
    ]);
    expect(evidence.map((item) => item.screenshotUrl)).toEqual([
      '/genui/bench/phase-two/screenshots/run-a2ui.png?v=20260729T000100000Z',
      '/genui/bench/phase-two/screenshots/run-openui.png?v=20260729T000100000Z',
    ]);
    expect(evidence.every((item) => item.pairId === 'pair-1')).toBe(true);
    expect(html).toContain('查看 UI Judge 实际渲染结果');
    expect(html).toContain('<dialog');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('run-a2ui.png');
    expect(html).toContain('run-openui.png');
    expect(html).toContain(
      'href="/genui/bench/phase-two/screenshots/run-a2ui.png',
    );
    expect(html).toContain(
      'src="/genui/bench/phase-two/screenshots/run-openui.png',
    );
    expect(html).not.toContain('run-a2ui-2.png');
    expect(html).toContain('Weather content is complete.');
    expect(html).toContain(
      '图片来自正式 full Bench 中该 run 的 UI Judge 同一次 Lynx capture',
    );
    expect(html).toContain(
      'canonical report 未保存截图或完整协议输出',
    );
    expect(html).not.toMatch(/代表性复跑|证据复跑|不参与汇总指标/);
    expect(englishHtml).toContain('View UI Judge render results');
    expect(englishHtml).toContain(
      'Each image comes from the same Lynx capture scored by UI Judge',
    );
    expect(englishHtml).toContain(
      'aria-label="Close UI Judge render results"',
    );
    expect(englishHtml).toContain(
      'aria-label="Select a UI Judge screenshot scenario"',
    );
    expect(englishHtml).toContain('A2UI Lynx render for Weather');
    expect(englishHtml).not.toContain('查看 UI Judge 实际渲染结果');
  });

  test('resolves formal screenshots against the Rsbuild asset prefix', () => {
    const screenshotUrl =
      '/bench/phase-two/screenshots/run-a2ui.png?v=20260729T000100000Z';

    expect(resolveFormalScreenshotAssetUrl(screenshotUrl, '')).toBe(
      screenshotUrl,
    );
    expect(resolveFormalScreenshotAssetUrl(screenshotUrl, '/')).toBe(
      screenshotUrl,
    );
    expect(resolveFormalScreenshotAssetUrl(screenshotUrl, '/genui/')).toBe(
      `/genui${screenshotUrl}`,
    );
    expect(
      resolveFormalScreenshotAssetUrl(
        screenshotUrl,
        'https://static.example.com/genui/',
      ),
    ).toBe(`https://static.example.com/genui${screenshotUrl}`);
  });

  test('does not render untrusted or incomplete screenshot pairs', () => {
    const report = publishedFixture();
    report.sources = [{
      id: 'report',
      jobId: 'formal-job',
      status: 'complete',
      createdAt: '2026-07-29T00:00:00.000Z',
      completedAt: '2026-07-29T00:01:00.000Z',
      model: 'model-alpha',
      plannedRuns: 4,
      runCount: 3,
      failedRuns: 1,
    }];
    report.pairs[0]!.runs.a2ui!.screenshotUrl = 'data:image/png;base64,private';
    report.pairs[0]!.runs.openui!.screenshotUrl =
      '/bench/phase-two/screenshots/run-openui.png?v=wrong-version';

    expect(collectFormalScreenshotEvidence(report)).toEqual([]);
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, { report }),
    );
    expect(html).not.toContain('查看 UI Judge 实际渲染结果');
    expect(html).not.toContain('data:image');
  });

  test('uses an explicit methodology allow-list', () => {
    const report = publishedFixture();
    Object.assign(report.methodology, {
      baseURLs: ['https://should-never-render.invalid/private'],
    });
    const html = renderToStaticMarkup(
      React.createElement(PhaseTwoReportPage, { report }),
    );

    expect(html).not.toContain('Base URL');
    expect(html).not.toContain('baseURL');
    expect(html).not.toContain('should-never-render');
  });
});
