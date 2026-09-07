// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as SelectPrimitive from '@radix-ui/react-select';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { PHASE_TWO_PUBLISHED_REPORT } from './phaseTwoPublishedReport.js';
import './PhaseTwoReportPage.css';

type BenchLocale = 'en-US' | 'zh-CN';
type PublishedReport = typeof PHASE_TWO_PUBLISHED_REPORT;
type PublishedMetrics = PublishedReport['summary'];
type PublishedPair = PublishedReport['pairs'][number];
type Protocol = keyof PublishedPair['runs'];
type PublishedRun = NonNullable<PublishedPair['runs']['a2ui']>;
type PublishedSource = PublishedReport['sources'][number];
const FORMAL_SCREENSHOT_PREFIX = '/bench/phase-two/screenshots';
const SAFE_FORMAL_RUN_ID = /^\w[\w.-]{0,159}$/u;
const DEFAULT_BENCH_LOCALE: BenchLocale = 'zh-CN';

export interface FormalScreenshotEvidenceItem {
  id: string;
  pairId: string;
  sourceReportId: string;
  scenarioId: string;
  scenarioName: string;
  protocol: Protocol;
  repeatIndex: number;
  screenshotUrl: string;
  judge: PublishedRun['judge'] & { summary?: string };
  totalTokens: number;
  generationMs: number;
}
export type MetricKey =
  | 'finalValidRate'
  | 'passAt1Rate'
  | 'avgJudgeScoreAllRuns'
  | 'avgTokensAllRuns'
  | 'avgGenerationMsAllRuns'
  | 'avgAttemptsAllRuns';

interface MetricDefinition {
  key: MetricKey;
  label: string;
  shortLabel: string;
  direction: 'higher' | 'lower';
  description: string;
}

export interface PublishedSelectionSummary {
  a2ui: PublishedMetrics;
  completePairs: number;
  openui: PublishedMetrics;
  pairCoverageRate: number;
  pairCount: number;
}

export interface PairedOutcomeSummary {
  a2uiLosses: number;
  a2uiWins: number;
  comparablePairs: number;
  ties: number;
}

interface ScenarioDiagnostic {
  id: string;
  kind: 'error' | 'warning';
  message: string;
  protocol: Protocol;
}

const REPORT = PHASE_TWO_PUBLISHED_REPORT;

const EMPTY_METRICS: PublishedMetrics = {
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

const METRICS = [
  {
    key: 'finalValidRate',
    label: '最终有效率',
    shortLabel: 'Valid',
    direction: 'higher',
    description: '在全部计划运行中的最终协议有效率',
  },
  {
    key: 'passAt1Rate',
    label: '首轮通过率',
    shortLabel: 'Pass@1',
    direction: 'higher',
    description: '不经过修复，首轮即通过协议校验的比例',
  },
  {
    key: 'avgJudgeScoreAllRuns',
    label: 'UI Judge',
    shortLabel: 'Judge',
    direction: 'higher',
    description: '固定 Judge 模型在全部计划运行口径下的平均分',
  },
  {
    key: 'avgTokensAllRuns',
    label: '平均总 Tokens',
    shortLabel: 'Total Tokens',
    direction: 'lower',
    description: '每次计划运行的平均总 Tokens（input + output）',
  },
  {
    key: 'avgGenerationMsAllRuns',
    label: '平均生成耗时',
    shortLabel: 'Latency',
    direction: 'lower',
    description: 'Agent 从请求到协议输出的平均耗时',
  },
  {
    key: 'avgAttemptsAllRuns',
    label: '平均尝试次数',
    shortLabel: 'Attempts',
    direction: 'lower',
    description: '包含协议修复在内的平均生成尝试次数',
  },
] as const satisfies readonly MetricDefinition[];

const ENGLISH_METRIC_COPY = {
  finalValidRate: {
    label: 'Final valid rate',
    description: 'Final protocol validity across all planned runs',
  },
  passAt1Rate: {
    label: 'First-pass rate',
    description: 'Share of runs that pass protocol validation without a repair',
  },
  avgJudgeScoreAllRuns: {
    label: 'UI Judge',
    description:
      'Average score from the fixed Judge model across all planned runs',
  },
  avgTokensAllRuns: {
    label: 'Average total tokens',
    description: 'Average total tokens per planned run (input + output)',
  },
  avgGenerationMsAllRuns: {
    label: 'Average generation latency',
    description: 'Average Agent latency from request to protocol output',
  },
  avgAttemptsAllRuns: {
    label: 'Average attempts',
    description:
      'Average generation attempts, including protocol repair attempts',
  },
} as const satisfies Record<
  MetricKey,
  Pick<MetricDefinition, 'description' | 'label'>
>;

const ENGLISH_LIMITATION_COPY = new Map<string, string>([
  [
    '本轮只覆盖 3 个合成场景、单一生成模型与单一 UI Judge，未执行显著性检验。',
    'This run covers only three synthetic scenarios, one generation model, and one UI Judge, with no significance testing.',
  ],
  [
    '生成模型与 UI Judge 使用同一模型版本，Judge 结论可能存在同模型偏差。',
    'The generation model and UI Judge use the same model version, so Judge conclusions may be subject to same-model bias.',
  ],
  [
    'matched-core 统一场景、模型、运行环境与 Judge，但协议 schema、组件表达和适配 prompt 并不相同。',
    'matched-core aligns the scenario, model, runtime environment, and Judge, but the protocol schemas, component expressions, and adaptation prompts still differ.',
  ],
  [
    'UI Judge 只检查固定视口的静态 Lynx 截图，没有执行点击、滚动或其他交互步骤。',
    'UI Judge inspects only static Lynx screenshots at a fixed viewport; it does not perform clicks, scrolling, or other interactions.',
  ],
  [
    '未固定 temperature 或 seed；生成耗时包含外部模型服务波动与本机轻量任务影响，只适合方向性比较。',
    'Temperature and seed were not fixed. Generation latency includes external model-service variance and light local-task effects, so it supports directional comparison only.',
  ],
  [
    'Bench job store 为本地内存态，服务重启后不能从 API 恢复历史 job。',
    'The Bench job store is local in-memory state; historical jobs cannot be restored from the API after a server restart.',
  ],
  [
    '正式运行来自 dirty worktree；源码基线 commit 不能单独复现 bundle，需结合当时 diff 与飞书报告中的 bundle SHA-256。',
    'The formal run came from a dirty worktree. The source baseline commit alone cannot reproduce the bundle; the contemporaneous diff and bundle SHA-256 in the Lark report are also required.',
  ],
  [
    '独立 Render evaluator 未启用；本报告不能推导 Render、FMP 或 TTI。',
    'The independent Render evaluator was disabled; this report cannot infer Render, FMP, or TTI.',
  ],
]);

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function localize(
  locale: BenchLocale,
  zhCN: string,
  enUS: string,
): string {
  return locale === 'en-US' ? enUS : zhCN;
}

function localizeMetric(
  metric: MetricDefinition,
  locale: BenchLocale,
): MetricDefinition {
  return locale === 'en-US'
    ? { ...metric, ...ENGLISH_METRIC_COPY[metric.key] }
    : metric;
}

function localizeLimitation(
  limitation: string,
  locale: BenchLocale,
): string {
  return locale === 'en-US'
    ? (ENGLISH_LIMITATION_COPY.get(limitation) ?? limitation)
    : limitation;
}

function protocolLabel(protocol: Protocol): string {
  return protocol === 'a2ui' ? 'A2UI' : 'OpenUI';
}

export function combinePublishedMetrics(
  sources: readonly PublishedMetrics[],
): PublishedMetrics {
  if (sources.length === 0) return { ...EMPTY_METRICS };

  const metrics = { ...EMPTY_METRICS };
  for (const source of sources) {
    metrics.plannedRuns += source.plannedRuns;
    metrics.runCount += source.runCount;
    metrics.completedRuns += source.completedRuns;
    metrics.passAt1Runs += source.passAt1Runs;
    metrics.finalValidRuns += source.finalValidRuns;
    metrics.renderEnabledPlannedRuns += source.renderEnabledPlannedRuns;
    metrics.renderEvaluatedRuns += source.renderEvaluatedRuns;
    metrics.renderPassedRuns += source.renderPassedRuns;
    metrics.judgeEnabledPlannedRuns += source.judgeEnabledPlannedRuns;
    metrics.judgeEvaluatedRuns += source.judgeEvaluatedRuns;
    metrics.judgePassedRuns += source.judgePassedRuns;
    metrics.judgeScoreTotal += source.judgeScoreTotal;
    metrics.attemptsTotal += source.attemptsTotal;
    metrics.tokensTotal += source.tokensTotal;
    metrics.generationMsTotal += source.generationMsTotal;
  }

  const denominator = metrics.plannedRuns;
  metrics.failedRuns = Math.max(0, denominator - metrics.completedRuns);
  metrics.passAt1Rate = denominator > 0
    ? metrics.passAt1Runs / denominator
    : 0;
  metrics.finalValidRate = denominator > 0
    ? metrics.finalValidRuns / denominator
    : 0;
  metrics.renderCoverageRate = denominator > 0
    ? metrics.renderEvaluatedRuns / denominator
    : 0;
  metrics.renderPassRate = metrics.renderEnabledPlannedRuns > 0
    ? metrics.renderPassedRuns / metrics.renderEnabledPlannedRuns
    : null;
  metrics.judgeCoverageRate = denominator > 0
    ? metrics.judgeEvaluatedRuns / denominator
    : 0;
  metrics.avgJudgeScoreAllRuns = metrics.judgeEnabledPlannedRuns > 0
    ? metrics.judgeScoreTotal / metrics.judgeEnabledPlannedRuns
    : null;
  metrics.avgAttemptsAllRuns = denominator > 0
    ? metrics.attemptsTotal / denominator
    : 0;
  metrics.avgTokensAllRuns = denominator > 0
    ? metrics.tokensTotal / denominator
    : 0;
  metrics.avgGenerationMsAllRuns = denominator > 0
    ? metrics.generationMsTotal / denominator
    : 0;
  return metrics;
}

function protocolMetrics(
  report: PublishedReport,
  protocol: Protocol,
  model: string,
  scenario: string,
): PublishedMetrics {
  if (scenario !== 'all') {
    const scenarioSummary = report.scenarios.find((item) =>
      item.id === scenario
    );
    if (!scenarioSummary) return { ...EMPTY_METRICS };
    if (model === 'all') {
      return scenarioSummary.protocols.find((item) =>
        item.protocol === protocol
      )?.metrics ?? { ...EMPTY_METRICS };
    }
    return scenarioSummary.modelProtocols.find((item) =>
      item.model === model && item.protocol === protocol
    )?.metrics ?? { ...EMPTY_METRICS };
  }

  if (model !== 'all') {
    return report.models.find((item) => item.model === model)?.protocols.find(
      (item) => item.protocol === protocol,
    )?.metrics ?? { ...EMPTY_METRICS };
  }

  return combinePublishedMetrics(
    report.modelProtocols
      .filter((item) => item.protocol === protocol)
      .map((item) => item.metrics),
  );
}

export function summarizePublishedSelection(
  report: PublishedReport,
  model = 'all',
  scenario = 'all',
): PublishedSelectionSummary {
  const pairs = report.pairs.filter((pair) =>
    (model === 'all' || pair.model === model)
    && (scenario === 'all' || pair.scenarioId === scenario)
  );
  const completePairs = pairs.filter((pair) => pair.complete).length;
  return {
    a2ui: protocolMetrics(report, 'a2ui', model, scenario),
    completePairs,
    openui: protocolMetrics(report, 'openui', model, scenario),
    pairCoverageRate: pairs.length > 0 ? completePairs / pairs.length : 0,
    pairCount: pairs.length,
  };
}

function displayMetric(
  metrics: PublishedMetrics,
  key: MetricKey,
): number | null {
  if (metrics.plannedRuns === 0) return null;
  return metrics[key];
}

function formatMetric(key: MetricKey, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (key === 'finalValidRate' || key === 'passAt1Rate') {
    return `${(value * 100).toFixed(value === 0 || value === 1 ? 0 : 1)}%`;
  }
  if (key === 'avgJudgeScoreAllRuns') return `${value.toFixed(2)} / 5`;
  if (key === 'avgTokensAllRuns') {
    return NUMBER_FORMATTER.format(Math.round(value));
  }
  if (key === 'avgGenerationMsAllRuns') {
    return value >= 1000
      ? `${(value / 1000).toFixed(2)}s`
      : `${Math.round(value)}ms`;
  }
  return `${value.toFixed(2)}×`;
}

function metricDelta(
  metric: MetricDefinition,
  a2ui: number | null,
  openui: number | null,
): {
  advantage: number | null;
  delta: number | null;
  winner: Protocol | 'tie' | null;
} {
  if (
    a2ui === null
    || openui === null
    || !Number.isFinite(a2ui)
    || !Number.isFinite(openui)
  ) {
    return { advantage: null, delta: null, winner: null };
  }

  const delta = openui - a2ui;
  const directionalDelta = metric.direction === 'higher' ? delta : -delta;
  const scale = Math.max(Math.abs(a2ui), Math.abs(openui), 0.0001);
  const advantage = Math.max(-1, Math.min(1, directionalDelta / scale));
  const tolerance = scale * 0.001;
  const winner = Math.abs(delta) <= tolerance
    ? 'tie'
    : (directionalDelta > 0 ? 'openui' : 'a2ui');

  return { advantage, delta, winner };
}

function pairedMetricValue(
  run: PublishedRun | undefined,
  metricKey: MetricKey,
): number | null {
  if (!run) return null;
  switch (metricKey) {
    case 'finalValidRate':
      return run.finalValid ? 1 : 0;
    case 'passAt1Rate':
      return run.passAt1 ? 1 : 0;
    case 'avgJudgeScoreAllRuns':
      return run.judge.status === 'passed' && Number.isFinite(run.judge.score)
        ? run.judge.score
        : null;
    case 'avgTokensAllRuns':
      return Number.isFinite(run.totalTokens) ? run.totalTokens : null;
    case 'avgGenerationMsAllRuns':
      return Number.isFinite(run.generationMs) ? run.generationMs : null;
    case 'avgAttemptsAllRuns':
      return Number.isFinite(run.attemptCount) ? run.attemptCount : null;
  }
}

function pairedWinner(
  metric: MetricDefinition,
  a2ui: number | null,
  openui: number | null,
): Protocol | 'tie' | null {
  if (
    a2ui === null
    || openui === null
    || !Number.isFinite(a2ui)
    || !Number.isFinite(openui)
  ) {
    return null;
  }
  if (a2ui === openui) return 'tie';
  const a2uiWins = metric.direction === 'higher'
    ? a2ui > openui
    : a2ui < openui;
  return a2uiWins ? 'a2ui' : 'openui';
}

export function summarizePairedOutcomes(
  pairs: readonly PublishedPair[],
  metricKey: MetricKey,
  model = 'all',
  scenario = 'all',
): PairedOutcomeSummary {
  const metric = METRICS.find((item) => item.key === metricKey);
  const summary: PairedOutcomeSummary = {
    a2uiLosses: 0,
    a2uiWins: 0,
    comparablePairs: 0,
    ties: 0,
  };
  if (!metric) return summary;

  for (const pair of pairs) {
    if (
      (model !== 'all' && pair.model !== model)
      || (scenario !== 'all' && pair.scenarioId !== scenario)
    ) {
      continue;
    }
    const winner = pairedWinner(
      metric,
      pairedMetricValue(pair.runs.a2ui, metricKey),
      pairedMetricValue(pair.runs.openui, metricKey),
    );
    if (winner === null) continue;

    summary.comparablePairs += 1;
    if (winner === 'a2ui') {
      summary.a2uiWins += 1;
    } else if (winner === 'openui') {
      summary.a2uiLosses += 1;
    } else {
      summary.ties += 1;
    }
  }
  return summary;
}

function describeDelta(
  metric: MetricDefinition,
  a2ui: number | null,
  openui: number | null,
  locale: BenchLocale = DEFAULT_BENCH_LOCALE,
): string {
  const result = metricDelta(metric, a2ui, openui);
  if (result.winner === null || result.delta === null) {
    return localize(locale, '数据不足', 'Insufficient data');
  }
  if (result.winner === 'tie') {
    return localize(locale, '本轮持平', 'Tied in this run');
  }
  const difference = Math.abs(result.delta);
  const direction = metric.direction === 'higher'
    ? localize(locale, '高', 'is higher by')
    : localize(locale, '低', 'is lower by');
  return `${protocolLabel(result.winner)} ${direction} ${
    formatMetric(metric.key, difference)
  }`;
}

function hasIncompleteCoverage(metrics: PublishedMetrics): boolean {
  if (
    metrics.runCount < metrics.plannedRuns
    || metrics.completedRuns + metrics.failedRuns < metrics.plannedRuns
  ) {
    return true;
  }
  if (
    metrics.judgeEnabledPlannedRuns > 0
    && (
      metrics.judgeEnabledPlannedRuns < metrics.plannedRuns
      || metrics.judgeEvaluatedRuns < metrics.judgeEnabledPlannedRuns
    )
  ) {
    return true;
  }
  return metrics.renderEnabledPlannedRuns > 0
    && (
      metrics.renderEnabledPlannedRuns < metrics.plannedRuns
      || metrics.renderEvaluatedRuns < metrics.renderEnabledPlannedRuns
    );
}

export function buildThesis(
  a2ui: PublishedMetrics,
  openui: PublishedMetrics,
  pairCount: number,
  completePairs: number,
  locale: BenchLocale = DEFAULT_BENCH_LOCALE,
): string {
  if (pairCount === 0) {
    return localize(
      locale,
      '当前筛选范围没有完整的 paired 样本，暂时不能判断协议差异。',
      'No complete paired samples are available for the current filters, so protocol differences cannot yet be assessed.',
    );
  }
  if (
    completePairs < pairCount
    || hasIncompleteCoverage(a2ui)
    || hasIncompleteCoverage(openui)
  ) {
    return localize(
      locale,
      `本轮仅有 ${completePairs}/${pairCount} 个 pair 同时取得双协议结果，或 Judge / Render 覆盖不完整；当前只展示观测值，不形成协议优劣结论。`,
      `Only ${completePairs}/${pairCount} pairs produced results for both protocols, or Judge / Render coverage is incomplete. The report therefore shows observations without drawing a protocol-ranking conclusion.`,
    );
  }

  const candidates = METRICS.flatMap((metric) => {
    const result = metricDelta(
      metric,
      displayMetric(a2ui, metric.key),
      displayMetric(openui, metric.key),
    );
    return result.winner === null || result.winner === 'tie'
        || result.advantage === null
      ? []
      : [{ metric, ...result }];
  }).sort((left, right) =>
    Math.abs(right.advantage ?? 0) - Math.abs(left.advantage ?? 0)
  );

  const strongest = candidates[0];
  if (!strongest || Math.abs(strongest.advantage ?? 0) < 0.02) {
    return localize(
      locale,
      '本轮核心指标整体接近；协议选择应回到逐场景稳定性与产出成本，而不是只看总均值。',
      'The core metrics are broadly similar in this run. Protocol selection should consider per-scenario stability and output cost rather than aggregate averages alone.',
    );
  }

  const winner = protocolLabel(strongest.winner as Protocol);
  const metricLabel = localizeMetric(strongest.metric, locale).label;
  return localize(
    locale,
    `${winner} 在${metricLabel}上呈现本轮最明显的方向性优势；这不是显著性结论，仍需结合中轴差值与逐场景账本判断。`,
    `${winner} shows the clearest directional advantage in ${metricLabel}. This is not a statistical-significance claim; interpret it alongside the zero-axis delta and per-scenario ledger.`,
  );
}

function moveTabFocus(
  event: import('react').KeyboardEvent<HTMLButtonElement>,
) {
  if (
    event.key !== 'ArrowLeft'
    && event.key !== 'ArrowRight'
    && event.key !== 'Home'
    && event.key !== 'End'
  ) {
    return;
  }

  const tabList = event.currentTarget.closest('[role="tablist"]');
  const tabs = Array.from(
    tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;

  event.preventDefault();
  let nextIndex = currentIndex;
  if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = tabs.length - 1;
  } else {
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
  }
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function ReportSectionHeader(props: {
  description: string;
  id: string;
  index: string;
  label: string;
  title: string;
}) {
  return (
    <div className='phaseTwoReportSectionHead'>
      <span aria-hidden='true'>{props.index}</span>
      <div>
        <small>{props.label}</small>
        <h2 id={props.id}>{props.title}</h2>
        <p>{props.description}</p>
      </div>
    </div>
  );
}

interface ReportSelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

function ReportSelect(props: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly ReportSelectOption[];
  placeholder: string;
  value: string;
}) {
  const labelId = `${props.id}-label`;

  return (
    <div className='phaseTwoReportFilter'>
      <span className='phaseTwoReportFilterLabel' id={labelId}>
        {props.label}
      </span>
      <SelectPrimitive.Root
        value={props.value}
        disabled={props.disabled}
        onValueChange={props.onChange}
      >
        <div className='phaseTwoReportSelectControl'>
          <SelectPrimitive.Trigger
            id={props.id}
            className='phaseTwoReportSelectTrigger'
            aria-labelledby={labelId}
          >
            <SelectPrimitive.Value placeholder={props.placeholder} />
            <SelectPrimitive.Icon
              className='phaseTwoReportSelectChevron'
              asChild
            >
              <span>
                <svg viewBox='0 0 16 16' aria-hidden='true'>
                  <path d='m4 6 4 4 4-4' />
                </svg>
              </span>
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
        </div>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className='phaseTwoReportSelectContent'
            position='popper'
            sideOffset={6}
            align='start'
            collisionPadding={16}
          >
            <SelectPrimitive.Viewport className='phaseTwoReportSelectViewport'>
              {props.options.map((option) => (
                <SelectPrimitive.Item
                  className='phaseTwoReportSelectOption'
                  value={option.value}
                  disabled={option.disabled}
                  key={option.value}
                >
                  <span
                    className='phaseTwoReportSelectOptionCheck'
                    aria-hidden='true'
                  >
                    <SelectPrimitive.ItemIndicator>
                      <svg viewBox='0 0 16 16'>
                        <path d='m3 8 3 3 7-7' />
                      </svg>
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

function formalScreenshotVersion(completedAt: string): string | undefined {
  const instant = new Date(completedAt);
  if (Number.isNaN(instant.getTime())) return undefined;
  return instant.toISOString().replace(/[-:.]/gu, '');
}

export function resolveFormalScreenshotAssetUrl(
  screenshotUrl: string,
  assetPrefix = import.meta.env.ASSET_PREFIX ?? '',
): string {
  const normalizedPrefix = assetPrefix.replace(/\/+$/u, '');
  const normalizedPath = screenshotUrl.startsWith('/')
    ? screenshotUrl
    : `/${screenshotUrl}`;
  return `${normalizedPrefix}${normalizedPath}`;
}

function isFormalScreenshotUrl(
  run: PublishedRun,
  source: PublishedSource,
): run is PublishedRun & { screenshotUrl: string } {
  const version = formalScreenshotVersion(source.completedAt);
  return Boolean(
    version
      && SAFE_FORMAL_RUN_ID.test(run.id)
      && run.status === 'complete'
      && run.finalValid
      && run.judge.status === 'passed'
      && run.screenshotUrl
        === `${FORMAL_SCREENSHOT_PREFIX}/${run.id}.png?v=${version}`,
  );
}

/**
 * Selects one complete, formally measured pair per scenario. The image URL is
 * accepted only when it points to the static file derived from that exact run.
 */
export function collectFormalScreenshotEvidence(
  report: PublishedReport,
  repeatIndex = 1,
): FormalScreenshotEvidenceItem[] {
  if (report.sources.length !== 1) return [];
  const source = report.sources[0];
  if (!source || source.status !== 'complete') return [];

  const evidence: FormalScreenshotEvidenceItem[] = [];
  const seenScenarios = new Set<string>();
  for (const pair of report.pairs) {
    if (
      pair.sourceReportId !== source.id
      || !pair.complete
      || pair.repeatIndex !== repeatIndex
      || seenScenarios.has(pair.scenarioId)
    ) {
      continue;
    }
    const a2ui = pair.runs.a2ui;
    const openui = pair.runs.openui;
    if (
      !a2ui
      || !openui
      || !isFormalScreenshotUrl(a2ui, source)
      || !isFormalScreenshotUrl(openui, source)
    ) {
      continue;
    }
    seenScenarios.add(pair.scenarioId);
    for (const run of [a2ui, openui]) {
      evidence.push({
        id: run.id,
        pairId: pair.pairId,
        sourceReportId: pair.sourceReportId,
        scenarioId: pair.scenarioId,
        scenarioName: pair.scenarioName,
        protocol: run.protocol,
        repeatIndex: pair.repeatIndex,
        screenshotUrl: resolveFormalScreenshotAssetUrl(run.screenshotUrl),
        judge: run.judge,
        totalTokens: run.totalTokens,
        generationMs: run.generationMs,
      });
    }
  }
  return evidence;
}

function JudgeScreenshotGallery(props: {
  evidence: readonly FormalScreenshotEvidenceItem[];
  locale: BenchLocale;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scenarioIds = [
    ...new Set(props.evidence.map((item) => item.scenarioId)),
  ];
  const [evidenceScenarioId, setEvidenceScenarioId] = useState(
    scenarioIds[0] ?? '',
  );
  const selectedScenarioId = scenarioIds.includes(evidenceScenarioId)
    ? evidenceScenarioId
    : (scenarioIds[0] ?? '');
  const selected = props.evidence.filter(
    (item) => item.scenarioId === selectedScenarioId,
  ).sort((left, right) =>
    left.protocol === right.protocol
      ? 0
      : (left.protocol === 'a2ui' ? -1 : 1)
  );
  const selectedName = selected[0]?.scenarioName
    ?? localize(props.locale, '渲染样本', 'Rendered sample');

  if (scenarioIds.length === 0) return null;

  return (
    <>
      <button
        className='phaseTwoReportEvidenceTrigger'
        type='button'
        onClick={() => dialogRef.current?.showModal()}
      >
        <span>
          <strong>
            {localize(
              props.locale,
              '查看 UI Judge 实际渲染结果',
              'View UI Judge render results',
            )}
          </strong>
          <small>
            {localize(
              props.locale,
              `${scenarioIds.length} 个场景 · 正式 repeat 1 · A2UI / OpenUI`,
              `${scenarioIds.length} scenarios · formal repeat 1 · A2UI / OpenUI`,
            )}
          </small>
        </span>
        <span aria-hidden='true'>
          {localize(props.locale, '打开', 'Open')}
        </span>
      </button>

      <dialog
        className='phaseTwoReportEvidenceDialog'
        ref={dialogRef}
        aria-labelledby='phase-two-report-evidence-title'
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.close();
          }
        }}
      >
        <div className='phaseTwoReportEvidenceDialogPanel'>
          <header className='phaseTwoReportEvidenceDialogHeader'>
            <div>
              <h3 id='phase-two-report-evidence-title'>
                {localize(
                  props.locale,
                  'UI Judge 实际渲染结果',
                  'UI Judge render results',
                )}
              </h3>
              <p>
                {localize(
                  props.locale,
                  '图片来自正式 full Bench 中该 run 的 UI Judge 同一次 Lynx capture；当前按每个场景 repeat 1 抽样展示。',
                  'Each image comes from the same Lynx capture scored by UI Judge for that run in the formal full Bench. The gallery shows repeat 1 for each scenario.',
                )}
              </p>
            </div>
            <button
              type='button'
              aria-label={localize(
                props.locale,
                '关闭 UI Judge 实际渲染结果',
                'Close UI Judge render results',
              )}
              onClick={() => dialogRef.current?.close()}
            >
              {localize(props.locale, '关闭', 'Close')}
            </button>
          </header>

          <div
            className='phaseTwoReportEvidenceDialogTabs'
            role='tablist'
            aria-label={localize(
              props.locale,
              '选择 UI Judge 截图场景',
              'Select a UI Judge screenshot scenario',
            )}
          >
            {scenarioIds.map((scenarioId) => {
              const name = props.evidence.find((item) =>
                item.scenarioId === scenarioId
              )?.scenarioName ?? scenarioId;
              return (
                <button
                  id={`phase-two-report-evidence-${scenarioId}`}
                  type='button'
                  role='tab'
                  aria-controls='phase-two-report-evidence-panel'
                  aria-selected={selectedScenarioId === scenarioId}
                  tabIndex={selectedScenarioId === scenarioId ? 0 : -1}
                  onClick={() => setEvidenceScenarioId(scenarioId)}
                  onKeyDown={moveTabFocus}
                  key={scenarioId}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div
            className='phaseTwoReportEvidenceDialogBody'
            id='phase-two-report-evidence-panel'
            role='tabpanel'
            aria-labelledby={`phase-two-report-evidence-${selectedScenarioId}`}
          >
            <header>
              <strong>{selectedName}</strong>
              <span>
                {localize(
                  props.locale,
                  '同任务 · 同模型 · 同一正式 pair',
                  'Same task · same model · same formal pair',
                )}
              </span>
            </header>
            <div className='phaseTwoReportEvidenceGrid'>
              {selected.map((item) => (
                <figure
                  data-protocol={item.protocol}
                  key={item.id}
                >
                  <a
                    href={item.screenshotUrl}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <img
                      src={item.screenshotUrl}
                      alt={localize(
                        props.locale,
                        `${item.scenarioName} 的 ${
                          protocolLabel(item.protocol)
                        } Lynx 实际渲染截图`,
                        `${
                          protocolLabel(item.protocol)
                        } Lynx render for ${item.scenarioName}`,
                      )}
                      loading='lazy'
                    />
                  </a>
                  <figcaption>
                    <div>
                      <strong>{protocolLabel(item.protocol)}</strong>
                      <span>
                        Judge {item.judge.score.toFixed(1)} / 5 · repeat{' '}
                        {item.repeatIndex}
                      </span>
                    </div>
                    <small>
                      {item.judge.model} ·{' '}
                      {NUMBER_FORMATTER.format(item.totalTokens)} tokens
                    </small>
                    {item.judge.summary && <p>{item.judge.summary}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

function MetricBeam(props: {
  a2ui: PublishedMetrics;
  completePairs: number;
  locale: BenchLocale;
  metric: MetricDefinition;
  openui: PublishedMetrics;
  outcomes: PairedOutcomeSummary;
  pairCount: number;
}) {
  const a2uiValue = displayMetric(props.a2ui, props.metric.key);
  const openuiValue = displayMetric(props.openui, props.metric.key);
  const result = metricDelta(props.metric, a2uiValue, openuiValue);
  const width = result.advantage === null
    ? 0
    : Math.max(0, Math.min(50, Math.abs(result.advantage) * 50));

  return (
    <div
      className='phaseTwoReportBeamPanel'
      id='phase-two-report-metric-panel'
      role='tabpanel'
      aria-labelledby={`phase-two-report-tab-${props.metric.key}`}
    >
      <div className='phaseTwoReportBeamHeader'>
        <div>
          <span>{props.metric.description}</span>
          <strong>
            {describeDelta(
              props.metric,
              a2uiValue,
              openuiValue,
              props.locale,
            )}
          </strong>
        </div>
        <small>
          {props.completePairs}/{props.pairCount} {localize(
            props.locale,
            'complete / planned pairs',
            'complete / planned pairs',
          )} · {props.metric.direction === 'higher'
            ? localize(props.locale, '越高越好', 'higher is better')
            : localize(props.locale, '越低越好', 'lower is better')}
        </small>
      </div>

      <div
        className='phaseTwoReportPairRecord'
        role='group'
        aria-label={localize(
          props.locale,
          `${props.metric.label}的 A2UI 配对结果：${props.outcomes.a2uiWins} 胜，${props.outcomes.ties} 平，${props.outcomes.a2uiLosses} 负；${props.outcomes.comparablePairs} 个可比较 pair`,
          `${props.metric.label}, paired results from the A2UI perspective: ${props.outcomes.a2uiWins} wins, ${props.outcomes.ties} ties, ${props.outcomes.a2uiLosses} losses; ${props.outcomes.comparablePairs} comparable pairs`,
        )}
      >
        <span aria-hidden='true'>A2UI W / T / L</span>
        <strong aria-hidden='true'>
          <b data-outcome='win'>{props.outcomes.a2uiWins}</b>
          <i>/</i>
          <b data-outcome='tie'>{props.outcomes.ties}</b>
          <i>/</i>
          <b data-outcome='loss'>{props.outcomes.a2uiLosses}</b>
        </strong>
        <small aria-hidden='true'>
          {props.outcomes.comparablePairs} {localize(
            props.locale,
            'comparable pairs · A2UI perspective',
            'comparable pairs · A2UI perspective',
          )}
        </small>
      </div>

      <div
        className='phaseTwoReportBeam'
        data-winner={result.winner ?? 'unknown'}
      >
        <div className='phaseTwoReportBeamValue' data-protocol='a2ui'>
          <span>A2UI</span>
          <strong>{formatMetric(props.metric.key, a2uiValue)}</strong>
        </div>
        <div className='phaseTwoReportBeamValue' data-protocol='openui'>
          <span>OpenUI</span>
          <strong>{formatMetric(props.metric.key, openuiValue)}</strong>
        </div>
        <div className='phaseTwoReportBeamAxis' aria-hidden='true'>
          <span className='phaseTwoReportBeamBaseline' />
          <span className='phaseTwoReportBeamZero'>0</span>
          {result.winner === 'a2ui' && (
            <span
              className='phaseTwoReportBeamFill'
              data-side='a2ui'
              style={{ width: `${width}%` }}
            />
          )}
          {result.winner === 'openui' && (
            <span
              className='phaseTwoReportBeamFill'
              data-side='openui'
              style={{ width: `${width}%` }}
            />
          )}
          {result.winner === 'tie'
            && <span className='phaseTwoReportBeamTie' />}
        </div>
        <div className='phaseTwoReportBeamLegend' aria-hidden='true'>
          <span>A2UI advantage</span>
          <span>paired delta</span>
          <span>OpenUI advantage</span>
        </div>
      </div>
    </div>
  );
}

function ProtocolOverview(props: {
  locale: BenchLocale;
  metrics: PublishedMetrics;
  protocol: Protocol;
}) {
  const rows = [
    [
      localize(props.locale, '最终有效率', 'Final valid rate'),
      formatMetric(
        'finalValidRate',
        displayMetric(props.metrics, 'finalValidRate'),
      ),
    ],
    [
      localize(props.locale, '首轮通过率', 'First-pass rate'),
      formatMetric('passAt1Rate', displayMetric(props.metrics, 'passAt1Rate')),
    ],
    [
      'UI Judge',
      formatMetric(
        'avgJudgeScoreAllRuns',
        displayMetric(props.metrics, 'avgJudgeScoreAllRuns'),
      ),
    ],
    [
      localize(props.locale, '平均总 Tokens', 'Average total tokens'),
      formatMetric(
        'avgTokensAllRuns',
        displayMetric(props.metrics, 'avgTokensAllRuns'),
      ),
    ],
    [
      localize(
        props.locale,
        '平均生成耗时',
        'Average generation latency',
      ),
      formatMetric(
        'avgGenerationMsAllRuns',
        displayMetric(props.metrics, 'avgGenerationMsAllRuns'),
      ),
    ],
  ] as const;

  return (
    <article
      className='phaseTwoReportProtocol'
      data-protocol={props.protocol}
    >
      <header>
        <span aria-hidden='true'>
          {props.protocol === 'a2ui' ? 'A' : 'O'}
        </span>
        <div>
          <h3>{protocolLabel(props.protocol)}</h3>
          <p>
            {props.metrics.plannedRuns} {localize(
              props.locale,
              'planned protocol runs',
              'planned protocol runs',
            )}
          </p>
        </div>
      </header>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <footer>
        <span>
          {localize(props.locale, '完成', 'Completed')}{' '}
          {props.metrics.completedRuns}
        </span>
        <span>
          {localize(props.locale, '失败', 'Failed')} {props.metrics.failedRuns}
        </span>
        <span>
          Judge coverage {Math.round(props.metrics.judgeCoverageRate * 100)}%
        </span>
      </footer>
    </article>
  );
}

function formatMethodologyValue(
  value: unknown,
  locale: BenchLocale,
): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatMethodologyValue(item, locale)).join(
      ' · ',
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${formatMethodologyValue(item, locale)}`)
      .join(' · ');
  }
  if (typeof value === 'boolean') {
    return value
      ? localize(locale, 'enabled', 'enabled')
      : localize(locale, 'disabled', 'disabled');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return '—';
}

function methodologyLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .replace(/^./u, (character) => character.toUpperCase());
}

function collectScenarioDiagnostics(
  pairs: readonly PublishedPair[],
  scenarioId: string,
  locale: BenchLocale,
): ScenarioDiagnostic[] {
  const diagnostics = new Map<string, ScenarioDiagnostic>();
  const add = (
    pair: PublishedPair,
    protocol: Protocol,
    kind: ScenarioDiagnostic['kind'],
    message: string,
  ) => {
    const normalized = message.trim();
    if (!normalized) return;
    const id = `${pair.id}\u0000${protocol}\u0000${kind}\u0000${normalized}`;
    diagnostics.set(id, {
      id,
      kind,
      message: `${pair.model} · repeat ${pair.repeatIndex}: ${normalized}`,
      protocol,
    });
  };

  for (const pair of pairs) {
    if (pair.scenarioId !== scenarioId) continue;
    for (const protocol of ['a2ui', 'openui'] as const) {
      const run = pair.runs[protocol];
      if (!run) {
        add(
          pair,
          protocol,
          'error',
          localize(
            locale,
            '缺少计划运行结果',
            'Missing planned run result',
          ),
        );
        continue;
      }
      const errors = [...run.errors];
      const warnings = [...run.warnings];
      if (run.status === 'failed' && errors.length === 0) {
        errors.push(
          localize(
            locale,
            '运行失败，未提供错误详情',
            'The run failed without error details',
          ),
        );
      }
      for (const message of errors) add(pair, protocol, 'error', message);
      for (const message of warnings) add(pair, protocol, 'warning', message);
    }
  }
  return [...diagnostics.values()];
}

function MatchedCoreExplainer(props: { locale: BenchLocale }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className='phaseTwoReportMatchedCore'
      data-open={open ? 'true' : 'false'}
      ref={rootRef}
    >
      <button
        className='phaseTwoReportMatchedCoreTrigger'
        type='button'
        aria-controls='phase-two-report-matched-core-explainer'
        aria-expanded={open}
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
      >
        <span>matched-core paired report</span>
        <i aria-hidden='true'>?</i>
      </button>

      <aside
        className='phaseTwoReportMatchedCorePanel'
        id='phase-two-report-matched-core-explainer'
        role='region'
        aria-labelledby='phase-two-report-matched-core-title'
        hidden={!open}
      >
        <header>
          <div>
            <small>
              {localize(props.locale, '评测口径', 'Evaluation scope')}
            </small>
            <strong id='phase-two-report-matched-core-title'>
              {localize(
                props.locale,
                '什么是 matched-core？',
                'What is matched-core?',
              )}
            </strong>
            <p>
              {localize(
                props.locale,
                '它表示在可对齐的核心条件下做成对比较：同一任务、模型和重复轮次，分别生成 A2UI 与 OpenUI，再进入同一套 Lynx 渲染与 UI Judge。',
                'It compares the protocols in pairs under aligned core conditions: the same task, model, and repeat generate A2UI and OpenUI outputs, which then enter the same Lynx rendering and UI Judge pipeline.',
              )}
            </p>
          </div>
          <button
            type='button'
            aria-label={localize(
              props.locale,
              '收起 matched-core 说明',
              'Collapse the matched-core explanation',
            )}
            onClick={closeAndRestoreFocus}
          >
            {localize(props.locale, '收起', 'Collapse')}
          </button>
        </header>

        <div
          className='phaseTwoReportMatchedCoreFlow'
          aria-label={localize(
            props.locale,
            'matched-core 配对评测流程',
            'matched-core paired evaluation flow',
          )}
        >
          <div>
            <small>
              {localize(props.locale, '01 · 配对输入', '01 · Paired input')}
            </small>
            <strong>
              {localize(
                props.locale,
                '同一 task × model × repeat',
                'Same task × model × repeat',
              )}
            </strong>
          </div>
          <span aria-hidden='true'>→</span>
          <div>
            <small>
              {localize(
                props.locale,
                '02 · 协议分流',
                '02 · Protocol split',
              )}
            </small>
            <p>
              <b data-protocol='a2ui'>A2UI</b>
              <b data-protocol='openui'>OpenUI</b>
            </p>
          </div>
          <span aria-hidden='true'>→</span>
          <div>
            <small>
              {localize(
                props.locale,
                '03 · 同一把尺',
                '03 · Shared measure',
              )}
            </small>
            <strong>Lynx capture + UI Judge</strong>
          </div>
        </div>

        <dl className='phaseTwoReportMatchedCoreNotes'>
          <div>
            <dt>
              {localize(props.locale, '固定一致', 'Held constant')}
            </dt>
            <dd>
              {localize(
                props.locale,
                '生成模型、场景任务、重复轮次、运行环境、截图与 Judge 口径。',
                'Generation model, scenario task, repeat, runtime environment, screenshot, and Judge criteria.',
              )}
            </dd>
          </div>
          <div>
            <dt>
              {localize(props.locale, '保留差异', 'Kept distinct')}
            </dt>
            <dd>
              {localize(
                props.locale,
                '协议 schema、组件表达和适配 prompt 保持各自实现，不强行抹平。',
                'Each protocol retains its own schema, component expression, and adaptation prompt instead of forcing artificial equivalence.',
              )}
            </dd>
          </div>
          <div>
            <dt>
              {localize(props.locale, '如何解读', 'How to interpret it')}
            </dt>
            <dd>
              {localize(
                props.locale,
                '适合看相近条件下的配对方向，不代表统计显著或任何场景下的绝对优劣。',
                'Use it to inspect paired direction under similar conditions, not as proof of statistical significance or absolute superiority in every scenario.',
              )}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export function PhaseTwoReportPage(props: {
  locale?: BenchLocale;
  report?: PublishedReport;
}) {
  const locale = props.locale ?? DEFAULT_BENCH_LOCALE;
  const report = props.report ?? REPORT;
  const evidence = collectFormalScreenshotEvidence(report);
  const limitations = report.limitations.map((item) =>
    localizeLimitation(item, locale)
  );
  const modelOptions = useMemo(
    () => [
      ...new Set([
        ...report.models.map((item) => item.model),
        ...report.pairs.map((pair) => pair.model),
      ]),
    ],
    [report],
  );
  const [model, setModel] = useState('all');
  const [scenario, setScenario] = useState('all');
  const [metricKey, setMetricKey] = useState<MetricKey>('finalValidRate');

  const selection = useMemo(
    () => summarizePublishedSelection(report, model, scenario),
    [model, report, scenario],
  );
  const modelFilteredPairs = useMemo(
    () =>
      report.pairs.filter((pair) => model === 'all' || pair.model === model),
    [model, report],
  );
  const overall = useMemo(
    () => summarizePublishedSelection(report),
    [report],
  );
  const localizedMetrics = METRICS.map((item) => localizeMetric(item, locale));
  const metric = localizedMetrics.find((item) => item.key === metricKey)
    ?? localizedMetrics[0];
  const pairedOutcomes = useMemo(
    () => summarizePairedOutcomes(report.pairs, metric.key, model, scenario),
    [metric.key, model, report.pairs, scenario],
  );
  const thesis = buildThesis(
    overall.a2ui,
    overall.openui,
    overall.pairCount,
    overall.completePairs,
    locale,
  );
  const visibleScenarios = report.scenarios.filter((item) =>
    scenario === 'all' || item.id === scenario
  );
  const scenarioIdsForModel = new Set(
    modelFilteredPairs.map((pair) => pair.scenarioId),
  );
  const ledgerEntries = visibleScenarios.flatMap((item) => {
    const summary = summarizePublishedSelection(report, model, item.id);
    return summary.pairCount > 0
      ? [{
        diagnostics: collectScenarioDiagnostics(
          modelFilteredPairs,
          item.id,
          locale,
        ),
        item,
        summary,
      }]
      : [];
  });
  const methodology = [
    [
      localize(locale, '执行模式', 'Execution modes'),
      report.methodology.modes,
    ],
    [
      localize(locale, '能力口径', 'Capability profiles'),
      report.methodology.capabilityProfiles,
    ],
    [
      localize(locale, '协议版本', 'Protocol versions'),
      report.methodology.protocolVersions,
    ],
    ['Provider API', report.methodology.providerApis],
    [
      localize(locale, 'Judge 模型', 'Judge models'),
      report.methodology.judgeModels,
    ],
    [localize(locale, '重复轮次', 'Repeats'), report.methodology.repeats],
    [
      localize(locale, '最大尝试次数', 'Maximum attempts'),
      report.methodology.maxAttempts,
    ],
    [
      localize(locale, '超时时间（ms）', 'Timeout (ms)'),
      report.methodology.timeoutMs,
    ],
    ['Render', report.methodology.renderEnabled],
    ['Judge', report.methodology.judgeEnabled],
  ] as const;

  return (
    <main className='phaseTwoReportPage'>
      <header className='phaseTwoReportHero'>
        <div className='phaseTwoReportHeroMeta'>
          <span>Lynx A2UI Bench · Phase 02</span>
          <MatchedCoreExplainer locale={locale} />
        </div>
        <div className='phaseTwoReportHeroGrid'>
          <div className='phaseTwoReportHeroLead'>
            <p className='phaseTwoReportEyebrow'>
              A2UI <i aria-hidden='true' /> OpenUI
            </p>
            <h1>{report.title}</h1>
            <div className='phaseTwoReportThesis'>
              <span>{localize(locale, '结论', 'Conclusion')}</span>
              <p>{thesis}</p>
            </div>
          </div>
          <dl className='phaseTwoReportScope'>
            <div>
              <dt>Generation models</dt>
              <dd>{modelOptions.length}</dd>
            </div>
            <div>
              <dt>Scenarios</dt>
              <dd>{report.scenarios.length}</dd>
            </div>
            <div>
              <dt>Complete / planned pairs</dt>
              <dd>
                {overall.completePairs} / {overall.pairCount}
              </dd>
              <small>
                {Math.round(overall.pairCoverageRate * 100)}% pair coverage
              </small>
            </div>
            <div>
              <dt>Source reports</dt>
              <dd>{report.sources.length}</dd>
            </div>
          </dl>
        </div>
        <div className='phaseTwoReportRunStrip'>
          <span>{localize(locale, '口径', 'Scope')}</span>
          <p>
            {localize(
              locale,
              '相同模型、相同任务、相同重复轮次，分别生成 A2UI 与 OpenUI，并以全部计划运行作为失败、缺失和取消样本的统一分母。',
              'A2UI and OpenUI are generated with the same model, task, and repeat. All planned runs form the shared denominator, including failed, missing, and cancelled samples.',
            )}
          </p>
        </div>
      </header>

      <section
        className='phaseTwoReportSection phaseTwoReportOverviewSection'
        aria-labelledby='phase-two-report-overview'
      >
        <ReportSectionHeader
          index='01'
          label='Protocol overview'
          id='phase-two-report-overview'
          title={localize(
            locale,
            '先看全局，再进入差值',
            'Start with the overview, then inspect the delta',
          )}
          description={localize(
            locale,
            '两侧指标独立按同一计划运行口径聚合；颜色只标识协议，不表达优劣。',
            'Both sides aggregate metrics over the same planned-run scope. Color identifies the protocol; it does not imply rank.',
          )}
        />
        {overall.pairCount > 0
          ? (
            <div className='phaseTwoReportProtocolPair'>
              <ProtocolOverview
                locale={locale}
                protocol='a2ui'
                metrics={overall.a2ui}
              />
              <div className='phaseTwoReportProtocolSpine' aria-hidden='true'>
                <span />
                <b>PAIR</b>
                <span />
              </div>
              <ProtocolOverview
                locale={locale}
                protocol='openui'
                metrics={overall.openui}
              />
            </div>
          )
          : (
            <div className='phaseTwoReportEmptyState' role='status'>
              <strong>
                {localize(
                  locale,
                  '尚无可发布的 paired evidence',
                  'No publishable paired evidence yet',
                )}
              </strong>
              <p>
                {localize(
                  locale,
                  '当前 artifact 不包含计划 pair。完成 Phase 2 运行并发布 canonical report 后，此处才会展示协议结论。',
                  'This artifact contains no planned pairs. Protocol conclusions appear after a Phase 2 run is completed and its canonical report is published.',
                )}
              </p>
            </div>
          )}
      </section>

      <section
        className='phaseTwoReportSection phaseTwoReportDeltaSection'
        aria-labelledby='phase-two-report-delta'
      >
        <ReportSectionHeader
          index='02'
          label='Paired delta instrument'
          id='phase-two-report-delta'
          title={localize(
            locale,
            '把差异放回同一条零轴',
            'Place each difference on a shared zero axis',
          )}
          description={localize(
            locale,
            '中轴不是排行榜：左侧表示 A2UI 占优，右侧表示 OpenUI 占优，横梁长度按两侧均值的相对差异缩放。',
            'The axis is not a leaderboard: left favors A2UI, right favors OpenUI, and beam length scales with the relative difference between their means.',
          )}
        />

        <div
          className='phaseTwoReportFilters'
          aria-label={localize(
            locale,
            '报告筛选条件',
            'Report filters',
          )}
        >
          <ReportSelect
            id='phase-two-report-model-filter'
            label='Generation model'
            placeholder={localize(locale, '暂无选项', 'No options')}
            value={model}
            disabled={modelOptions.length === 0}
            options={[
              {
                label: localize(locale, '全部模型', 'All models'),
                value: 'all',
              },
              ...modelOptions.map((item) => ({ label: item, value: item })),
            ]}
            onChange={setModel}
          />
          <ReportSelect
            id='phase-two-report-scenario-filter'
            label='Scenario'
            placeholder={localize(locale, '暂无选项', 'No options')}
            value={scenario}
            disabled={report.scenarios.length === 0}
            options={[
              {
                label: localize(locale, '全部场景', 'All scenarios'),
                value: 'all',
              },
              ...report.scenarios.map((item) => ({
                disabled: model !== 'all'
                  && !scenarioIdsForModel.has(item.id),
                label: item.name,
                value: item.id,
              })),
            ]}
            onChange={setScenario}
          />
          <div className='phaseTwoReportFilterReadout'>
            <span>PAIR SET</span>
            <strong>
              {selection.completePairs}/{selection.pairCount}
            </strong>
            <small>
              complete / planned ·{' '}
              {Math.round(selection.pairCoverageRate * 100)}% coverage
            </small>
          </div>
        </div>

        {selection.pairCount > 0
          ? (
            <>
              <div
                className='phaseTwoReportMetricTabs'
                role='tablist'
                aria-label={localize(
                  locale,
                  '选择配对指标',
                  'Select a paired metric',
                )}
              >
                {localizedMetrics.map((item) => (
                  <button
                    type='button'
                    role='tab'
                    id={`phase-two-report-tab-${item.key}`}
                    aria-controls='phase-two-report-metric-panel'
                    aria-selected={item.key === metric.key}
                    tabIndex={item.key === metric.key ? 0 : -1}
                    onClick={() => setMetricKey(item.key)}
                    onKeyDown={moveTabFocus}
                    key={item.key}
                  >
                    <span>{item.shortLabel}</span>
                    <small>
                      {describeDelta(
                        item,
                        displayMetric(selection.a2ui, item.key),
                        displayMetric(selection.openui, item.key),
                        locale,
                      )}
                    </small>
                  </button>
                ))}
              </div>

              <MetricBeam
                a2ui={selection.a2ui}
                completePairs={selection.completePairs}
                locale={locale}
                metric={metric}
                openui={selection.openui}
                outcomes={pairedOutcomes}
                pairCount={selection.pairCount}
              />
            </>
          )
          : (
            <div className='phaseTwoReportEmptyState' role='status'>
              <strong>
                {localize(
                  locale,
                  '此筛选暂无 paired evidence',
                  'No paired evidence for these filters',
                )}
              </strong>
              <p>
                {localize(
                  locale,
                  '当前模型与场景没有共同计划运行，因此不显示 0 值或“持平”结论。请选择其他筛选条件。',
                  'The selected model and scenario have no shared planned runs, so the report does not show a zero value or tie. Choose different filters.',
                )}
              </p>
            </div>
          )}
      </section>

      <section
        className='phaseTwoReportSection phaseTwoReportLedgerSection'
        aria-labelledby='phase-two-report-ledger'
      >
        <ReportSectionHeader
          index='03'
          label='Scenario ledger'
          id='phase-two-report-ledger'
          title={localize(
            locale,
            '逐场景核对方向是否一致',
            'Check whether the direction holds per scenario',
          )}
          description={localize(
            locale,
            'Ledger 跟随模型与场景筛选。均值差异只能说明本轮方向，不代表跨任务的统计显著性。',
            'The ledger follows the model and scenario filters. Mean differences show direction for this run, not statistical significance across tasks.',
          )}
        />
        <div className='phaseTwoReportLedgerWrap'>
          <table className='phaseTwoReportLedger'>
            <caption>
              {localize(
                locale,
                'A2UI 与 OpenUI 的逐场景 paired 聚合',
                'Per-scenario paired aggregates for A2UI and OpenUI',
              )}
            </caption>
            <thead>
              <tr>
                <th scope='col'>Scenario</th>
                <th scope='col'>Complete / planned</th>
                <th scope='col'>A2UI valid</th>
                <th scope='col'>OpenUI valid</th>
                <th scope='col'>Total token delta</th>
                <th scope='col'>Latency delta</th>
                <th scope='col'>Judge delta</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length > 0
                ? ledgerEntries.map(({ diagnostics, item, summary }) => (
                  <Fragment key={item.id}>
                    <tr>
                      <th scope='row'>
                        <strong>{item.name}</strong>
                        <small>
                          {item.type} · complexity {item.complexity}
                        </small>
                      </th>
                      <td>
                        {summary.completePairs}/{summary.pairCount}
                        <small className='phaseTwoReportLedgerCoverage'>
                          {Math.round(summary.pairCoverageRate * 100)}%
                        </small>
                      </td>
                      <td data-protocol='a2ui'>
                        {formatMetric(
                          'finalValidRate',
                          displayMetric(summary.a2ui, 'finalValidRate'),
                        )}
                      </td>
                      <td data-protocol='openui'>
                        {formatMetric(
                          'finalValidRate',
                          displayMetric(summary.openui, 'finalValidRate'),
                        )}
                      </td>
                      <td>
                        {describeDelta(
                          localizedMetrics[3],
                          displayMetric(summary.a2ui, 'avgTokensAllRuns'),
                          displayMetric(summary.openui, 'avgTokensAllRuns'),
                          locale,
                        )}
                      </td>
                      <td>
                        {describeDelta(
                          localizedMetrics[4],
                          displayMetric(
                            summary.a2ui,
                            'avgGenerationMsAllRuns',
                          ),
                          displayMetric(
                            summary.openui,
                            'avgGenerationMsAllRuns',
                          ),
                          locale,
                        )}
                      </td>
                      <td>
                        {describeDelta(
                          localizedMetrics[2],
                          displayMetric(
                            summary.a2ui,
                            'avgJudgeScoreAllRuns',
                          ),
                          displayMetric(
                            summary.openui,
                            'avgJudgeScoreAllRuns',
                          ),
                          locale,
                        )}
                      </td>
                    </tr>
                    {diagnostics.length > 0 && (
                      <tr className='phaseTwoReportDiagnosticsRow'>
                        <td colSpan={7}>
                          <details>
                            <summary>
                              {localize(
                                locale,
                                `${diagnostics.length} 条场景诊断`,
                                `${diagnostics.length} scenario diagnostics`,
                              )}
                            </summary>
                            <ul>
                              {diagnostics.map((diagnostic) => (
                                <li
                                  key={diagnostic.id}
                                  data-kind={diagnostic.kind}
                                  data-protocol={diagnostic.protocol}
                                >
                                  <strong>
                                    {protocolLabel(diagnostic.protocol)}
                                  </strong>
                                  <span>{diagnostic.message}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
                : (
                  <tr className='phaseTwoReportLedgerEmptyRow'>
                    <td colSpan={7}>
                      {localize(
                        locale,
                        '当前筛选没有计划 pair，无法生成逐场景 ledger。',
                        'The current filters contain no planned pairs, so a per-scenario ledger cannot be generated.',
                      )}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
        <JudgeScreenshotGallery evidence={evidence} locale={locale} />
      </section>

      <section
        className='phaseTwoReportSection phaseTwoReportMethodSection'
        aria-labelledby='phase-two-report-method'
      >
        <ReportSectionHeader
          index='04'
          label='Methodology & boundaries'
          id='phase-two-report-method'
          title={localize(
            locale,
            '结果成立的条件',
            'Conditions behind the results',
          )}
          description={localize(
            locale,
            '先确认匹配条件、覆盖率与失败分母，再把结果用于协议决策。',
            'Confirm matching conditions, coverage, and the failure denominator before using the results for protocol decisions.',
          )}
        />
        <div className='phaseTwoReportMethodGrid'>
          <article>
            <header>
              <span>METHOD</span>
              <h3>
                {localize(locale, '实验口径', 'Evaluation methodology')}
              </h3>
            </header>
            <dl>
              {methodology.map(([key, value]) => (
                <div key={key}>
                  <dt>{methodologyLabel(key)}</dt>
                  <dd>{formatMethodologyValue(value, locale)}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article>
            <header>
              <span>LIMITS</span>
              <h3>
                {localize(locale, '解读边界', 'Interpretation boundaries')}
              </h3>
            </header>
            {limitations.length > 0
              ? (
                <ul>
                  {limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )
              : (
                <p className='phaseTwoReportEmpty'>
                  {localize(
                    locale,
                    '当前报告未声明额外限制。',
                    'This report declares no additional limitations.',
                  )}
                </p>
              )}
            {report.warnings.length > 0 && (
              <details>
                <summary>
                  {localize(
                    locale,
                    `${report.warnings.length} 条运行告警`,
                    `${report.warnings.length} run warnings`,
                  )}
                </summary>
                <ul>
                  {report.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            )}
          </article>
        </div>
      </section>

      <footer className='phaseTwoReportFooter'>
        <div>
          <span>Lynx A2UI Bench · Phase 02</span>
          <p>
            {localize(
              locale,
              '协议差异应从 paired evidence 出发，而不是从单次截图出发。',
              'Protocol differences should be grounded in paired evidence, not a single screenshot.',
            )}
          </p>
        </div>
      </footer>
    </main>
  );
}
