// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as SelectPrimitive from '@radix-ui/react-select';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { PHASE_TWO_PUBLISHED_REPORT } from './phaseTwoPublishedReport.js';
import './PhaseTwoReportPage.css';

type PublishedReport = typeof PHASE_TWO_PUBLISHED_REPORT;
type PublishedMetrics = PublishedReport['summary'];
type PublishedPair = PublishedReport['pairs'][number];
type Protocol = keyof PublishedPair['runs'];
type PublishedRun = NonNullable<PublishedPair['runs']['a2ui']>;
type PublishedSource = PublishedReport['sources'][number];
const FORMAL_SCREENSHOT_PREFIX = '/bench/phase-two/screenshots';
const SAFE_FORMAL_RUN_ID = /^\w[\w.-]{0,159}$/u;

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

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

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
): string {
  const result = metricDelta(metric, a2ui, openui);
  if (result.winner === null || result.delta === null) return '数据不足';
  if (result.winner === 'tie') return '本轮持平';
  const difference = Math.abs(result.delta);
  return `${protocolLabel(result.winner)} ${
    metric.direction === 'higher' ? '高' : '低'
  } ${formatMetric(metric.key, difference)}`;
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
): string {
  if (pairCount === 0) {
    return '当前筛选范围没有完整的 paired 样本，暂时不能判断协议差异。';
  }
  if (
    completePairs < pairCount
    || hasIncompleteCoverage(a2ui)
    || hasIncompleteCoverage(openui)
  ) {
    return `本轮仅有 ${completePairs}/${pairCount} 个 pair 同时取得双协议结果，或 Judge / Render 覆盖不完整；当前只展示观测值，不形成协议优劣结论。`;
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
    return '本轮核心指标整体接近；协议选择应回到逐场景稳定性与产出成本，而不是只看总均值。';
  }

  return `${
    protocolLabel(strongest.winner as Protocol)
  } 在${strongest.metric.label}上呈现本轮最明显的方向性优势；这不是显著性结论，仍需结合中轴差值与逐场景账本判断。`;
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
            <SelectPrimitive.Value placeholder='暂无选项' />
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
        screenshotUrl: run.screenshotUrl,
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
  const selectedName = selected[0]?.scenarioName ?? '渲染样本';

  if (scenarioIds.length === 0) return null;

  return (
    <>
      <button
        className='phaseTwoReportEvidenceTrigger'
        type='button'
        onClick={() => dialogRef.current?.showModal()}
      >
        <span>
          <strong>查看 UI Judge 实际渲染结果</strong>
          <small>
            {scenarioIds.length} 个场景 · 正式 repeat 1 · A2UI / OpenUI
          </small>
        </span>
        <span aria-hidden='true'>打开</span>
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
                UI Judge 实际渲染结果
              </h3>
              <p>
                图片来自正式 full Bench 中该 run 的 UI Judge 同一次 Lynx
                capture；当前按每个场景 repeat 1 抽样展示。
              </p>
            </div>
            <button
              type='button'
              aria-label='关闭 UI Judge 实际渲染结果'
              onClick={() => dialogRef.current?.close()}
            >
              关闭
            </button>
          </header>

          <div
            className='phaseTwoReportEvidenceDialogTabs'
            role='tablist'
            aria-label='选择 UI Judge 截图场景'
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
              <span>同任务 · 同模型 · 同一正式 pair</span>
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
                      alt={`${item.scenarioName} 的 ${
                        protocolLabel(item.protocol)
                      } Lynx 实际渲染截图`}
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
          <strong>{describeDelta(props.metric, a2uiValue, openuiValue)}</strong>
        </div>
        <small>
          {props.completePairs}/{props.pairCount} complete / planned pairs ·
          {' '}
          {props.metric.direction === 'higher'
            ? '越高越好'
            : '越低越好'}
        </small>
      </div>

      <div
        className='phaseTwoReportPairRecord'
        role='group'
        aria-label={`${props.metric.label}的 A2UI 配对结果：${props.outcomes.a2uiWins} 胜，${props.outcomes.ties} 平，${props.outcomes.a2uiLosses} 负；${props.outcomes.comparablePairs} 个可比较 pair`}
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
          {props.outcomes.comparablePairs} comparable pairs · A2UI perspective
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
  metrics: PublishedMetrics;
  protocol: Protocol;
}) {
  const rows = [
    [
      '最终有效率',
      formatMetric(
        'finalValidRate',
        displayMetric(props.metrics, 'finalValidRate'),
      ),
    ],
    [
      '首轮通过率',
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
      '平均总 Tokens',
      formatMetric(
        'avgTokensAllRuns',
        displayMetric(props.metrics, 'avgTokensAllRuns'),
      ),
    ],
    [
      '平均生成耗时',
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
          <p>{props.metrics.plannedRuns} planned protocol runs</p>
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
        <span>完成 {props.metrics.completedRuns}</span>
        <span>失败 {props.metrics.failedRuns}</span>
        <span>
          Judge coverage {Math.round(props.metrics.judgeCoverageRate * 100)}%
        </span>
      </footer>
    </article>
  );
}

function formatMethodologyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatMethodologyValue(item)).join(' · ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${formatMethodologyValue(item)}`)
      .join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
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
        add(pair, protocol, 'error', '缺少计划运行结果');
        continue;
      }
      const errors = [...run.errors];
      const warnings = [...run.warnings];
      if (run.status === 'failed' && errors.length === 0) {
        errors.push('运行失败，未提供错误详情');
      }
      for (const message of errors) add(pair, protocol, 'error', message);
      for (const message of warnings) add(pair, protocol, 'warning', message);
    }
  }
  return [...diagnostics.values()];
}

function MatchedCoreExplainer() {
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
            <small>评测口径</small>
            <strong id='phase-two-report-matched-core-title'>
              什么是 matched-core？
            </strong>
            <p>
              它表示在可对齐的核心条件下做成对比较：同一任务、模型和重复轮次，
              分别生成 A2UI 与 OpenUI，再进入同一套 Lynx 渲染与 UI Judge。
            </p>
          </div>
          <button
            type='button'
            aria-label='收起 matched-core 说明'
            onClick={closeAndRestoreFocus}
          >
            收起
          </button>
        </header>

        <div
          className='phaseTwoReportMatchedCoreFlow'
          aria-label='matched-core 配对评测流程'
        >
          <div>
            <small>01 · 配对输入</small>
            <strong>同一 task × model × repeat</strong>
          </div>
          <span aria-hidden='true'>→</span>
          <div>
            <small>02 · 协议分流</small>
            <p>
              <b data-protocol='a2ui'>A2UI</b>
              <b data-protocol='openui'>OpenUI</b>
            </p>
          </div>
          <span aria-hidden='true'>→</span>
          <div>
            <small>03 · 同一把尺</small>
            <strong>Lynx capture + UI Judge</strong>
          </div>
        </div>

        <dl className='phaseTwoReportMatchedCoreNotes'>
          <div>
            <dt>固定一致</dt>
            <dd>生成模型、场景任务、重复轮次、运行环境、截图与 Judge 口径。</dd>
          </div>
          <div>
            <dt>保留差异</dt>
            <dd>
              协议 schema、组件表达和适配 prompt 保持各自实现，不强行抹平。
            </dd>
          </div>
          <div>
            <dt>如何解读</dt>
            <dd>
              适合看相近条件下的配对方向，不代表统计显著或任何场景下的绝对优劣。
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export function PhaseTwoReportPage(props: {
  report?: PublishedReport;
}) {
  const report = props.report ?? REPORT;
  const evidence = collectFormalScreenshotEvidence(report);
  const limitations = report.limitations;
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
  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0];
  const pairedOutcomes = useMemo(
    () => summarizePairedOutcomes(report.pairs, metric.key, model, scenario),
    [metric.key, model, report.pairs, scenario],
  );
  const thesis = buildThesis(
    overall.a2ui,
    overall.openui,
    overall.pairCount,
    overall.completePairs,
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
        ),
        item,
        summary,
      }]
      : [];
  });
  const methodology = [
    ['执行模式', report.methodology.modes],
    ['能力口径', report.methodology.capabilityProfiles],
    ['协议版本', report.methodology.protocolVersions],
    ['Provider API', report.methodology.providerApis],
    ['Judge 模型', report.methodology.judgeModels],
    ['重复轮次', report.methodology.repeats],
    ['最大尝试次数', report.methodology.maxAttempts],
    ['超时时间（ms）', report.methodology.timeoutMs],
    ['Render', report.methodology.renderEnabled],
    ['Judge', report.methodology.judgeEnabled],
  ] as const;

  return (
    <main className='phaseTwoReportPage'>
      <header className='phaseTwoReportHero'>
        <div className='phaseTwoReportHeroMeta'>
          <span>Lynx A2UI Bench · Phase 02</span>
          <MatchedCoreExplainer />
        </div>
        <div className='phaseTwoReportHeroGrid'>
          <div className='phaseTwoReportHeroLead'>
            <p className='phaseTwoReportEyebrow'>
              A2UI <i aria-hidden='true' /> OpenUI
            </p>
            <h1>{report.title}</h1>
            <div className='phaseTwoReportThesis'>
              <span>结论</span>
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
          <span>口径</span>
          <p>
            相同模型、相同任务、相同重复轮次，分别生成 A2UI 与 OpenUI，
            并以全部计划运行作为失败、缺失和取消样本的统一分母。
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
          title='先看全局，再进入差值'
          description='两侧指标独立按同一计划运行口径聚合；颜色只标识协议，不表达优劣。'
        />
        {overall.pairCount > 0
          ? (
            <div className='phaseTwoReportProtocolPair'>
              <ProtocolOverview protocol='a2ui' metrics={overall.a2ui} />
              <div className='phaseTwoReportProtocolSpine' aria-hidden='true'>
                <span />
                <b>PAIR</b>
                <span />
              </div>
              <ProtocolOverview protocol='openui' metrics={overall.openui} />
            </div>
          )
          : (
            <div className='phaseTwoReportEmptyState' role='status'>
              <strong>尚无可发布的 paired evidence</strong>
              <p>
                当前 artifact 不包含计划 pair。完成 Phase 2 运行并发布 canonical
                report 后，此处才会展示协议结论。
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
          title='把差异放回同一条零轴'
          description='中轴不是排行榜：左侧表示 A2UI 占优，右侧表示 OpenUI 占优，横梁长度按两侧均值的相对差异缩放。'
        />

        <div className='phaseTwoReportFilters' aria-label='报告筛选条件'>
          <ReportSelect
            id='phase-two-report-model-filter'
            label='Generation model'
            value={model}
            disabled={modelOptions.length === 0}
            options={[
              { label: '全部模型', value: 'all' },
              ...modelOptions.map((item) => ({ label: item, value: item })),
            ]}
            onChange={setModel}
          />
          <ReportSelect
            id='phase-two-report-scenario-filter'
            label='Scenario'
            value={scenario}
            disabled={report.scenarios.length === 0}
            options={[
              { label: '全部场景', value: 'all' },
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
                aria-label='选择配对指标'
              >
                {METRICS.map((item) => (
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
                      )}
                    </small>
                  </button>
                ))}
              </div>

              <MetricBeam
                a2ui={selection.a2ui}
                completePairs={selection.completePairs}
                metric={metric}
                openui={selection.openui}
                outcomes={pairedOutcomes}
                pairCount={selection.pairCount}
              />
            </>
          )
          : (
            <div className='phaseTwoReportEmptyState' role='status'>
              <strong>此筛选暂无 paired evidence</strong>
              <p>
                当前模型与场景没有共同计划运行，因此不显示 0
                值或“持平”结论。请选择其他筛选条件。
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
          title='逐场景核对方向是否一致'
          description='Ledger 跟随模型与场景筛选。均值差异只能说明本轮方向，不代表跨任务的统计显著性。'
        />
        <div className='phaseTwoReportLedgerWrap'>
          <table className='phaseTwoReportLedger'>
            <caption>A2UI 与 OpenUI 的逐场景 paired 聚合</caption>
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
                          METRICS[3],
                          displayMetric(summary.a2ui, 'avgTokensAllRuns'),
                          displayMetric(summary.openui, 'avgTokensAllRuns'),
                        )}
                      </td>
                      <td>
                        {describeDelta(
                          METRICS[4],
                          displayMetric(
                            summary.a2ui,
                            'avgGenerationMsAllRuns',
                          ),
                          displayMetric(
                            summary.openui,
                            'avgGenerationMsAllRuns',
                          ),
                        )}
                      </td>
                      <td>
                        {describeDelta(
                          METRICS[2],
                          displayMetric(
                            summary.a2ui,
                            'avgJudgeScoreAllRuns',
                          ),
                          displayMetric(
                            summary.openui,
                            'avgJudgeScoreAllRuns',
                          ),
                        )}
                      </td>
                    </tr>
                    {diagnostics.length > 0 && (
                      <tr className='phaseTwoReportDiagnosticsRow'>
                        <td colSpan={7}>
                          <details>
                            <summary>
                              {diagnostics.length} 条场景诊断
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
                      当前筛选没有计划 pair，无法生成逐场景 ledger。
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
        <JudgeScreenshotGallery evidence={evidence} />
      </section>

      <section
        className='phaseTwoReportSection phaseTwoReportMethodSection'
        aria-labelledby='phase-two-report-method'
      >
        <ReportSectionHeader
          index='04'
          label='Methodology & boundaries'
          id='phase-two-report-method'
          title='结果成立的条件'
          description='先确认匹配条件、覆盖率与失败分母，再把结果用于协议决策。'
        />
        <div className='phaseTwoReportMethodGrid'>
          <article>
            <header>
              <span>METHOD</span>
              <h3>实验口径</h3>
            </header>
            <dl>
              {methodology.map(([key, value]) => (
                <div key={key}>
                  <dt>{methodologyLabel(key)}</dt>
                  <dd>{formatMethodologyValue(value)}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article>
            <header>
              <span>LIMITS</span>
              <h3>解读边界</h3>
            </header>
            {limitations.length > 0
              ? (
                <ul>
                  {limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )
              : <p className='phaseTwoReportEmpty'>当前报告未声明额外限制。</p>}
            {report.warnings.length > 0 && (
              <details>
                <summary>{report.warnings.length} 条运行告警</summary>
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
          <p>协议差异应从 paired evidence 出发，而不是从单次截图出发。</p>
        </div>
      </footer>
    </main>
  );
}
