// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

import type { BenchLocale } from './benchLocale.js';
import type {
  BenchComparison,
  BenchMetricKey,
  PhaseOneBench,
} from './phaseOne.js';
import { getPhaseOneBench } from './phaseOne.js';
import './BenchResultPage.css';

const MODEL_EVIDENCE_URL = new URL(
  './assets/model-comparison.png',
  import.meta.url,
).href;
const PROMPT_EVIDENCE_URL = new URL(
  './assets/prompt-comparison.png',
  import.meta.url,
).href;
const CATALOG_EVIDENCE_URL = new URL(
  './assets/catalog-comparison.png',
  import.meta.url,
).href;

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

type DisplayMetric = Extract<
  BenchMetricKey,
  'totalTokens' | 'agentMs' | 'judge'
>;

const UI_COPY = {
  'zh-CN': {
    metricTabs: [
      {
        key: 'totalTokens',
        label: 'Tokens',
        description: 'Tokens 总量 · 越低越好',
      },
      {
        key: 'agentMs',
        label: 'Agent 耗时',
        description: 'Agent 生成耗时 · 越低越好',
      },
      {
        key: 'judge',
        label: 'UI Judge',
        description: 'UI Judge 得分 · 越高越好',
      },
    ],
    experimentLabels: {
      models: 'A · 模型',
      prompts: 'B · System Prompt',
      catalogs: 'C · Catalog',
    },
    fullMetrics: '完整指标',
    fullMetricsSummary: 'Tokens · Agent 耗时 · Runtime · UI Judge · 生成次数',
    agentLatency: 'Agent 耗时',
    generationAttempts: '生成次数',
    viewEvidence: '查看生成结果拼图',
    viewAllEvidence: '查看三组实验结果图',
    evidenceKinds: '模型 · System Prompt · Catalog',
    open: '打开',
    evidenceDialogTitle: '三组实验结果图',
    evidenceDialogHint: '点击图片可在新窗口查看原图。',
    closeEvidenceAria: '关闭实验结果图',
    close: '关闭',
    chooseEvidenceAria: '选择实验结果图',
    chooseExperimentAria: '选择实验',
    chooseMetricAria: '选择指标',
    currentExperiment: '当前实验',
    fixedCondition: '固定条件',
    scenarioAverage: (count: number) => `${count} 个场景的平均值`,
    metricBest: '该指标最佳',
    groupRecommendation: '本组建议 · 综合指标',
    whyRecommended: '为什么推荐',
    caveat: '需要注意',
    dataRevision: (revision: number, runs: number) =>
      `数据版本 Rev. ${revision} · ${runs} 次运行`,
    phaseResults: '一期测评结果',
    phaseConclusion: '一期结论',
    scopeAria: '实验范围',
    runs: '运行',
    scenarios: '场景',
    models: '模型',
    evidenceBoundary: '证据边界',
    evidenceBoundaryDetail:
      '这不是已经验证的最优组合：推荐来自三组单变量实验，三者尚未一起测试。',
    keyResults: '关键结果',
    keyResultsDetail: (count: number) =>
      `从模型、System Prompt 和 Catalog 三组实验中，摘取 ${count} 个关键结果。`,
    experimentComparison: '实验对比',
    experimentComparisonDetail:
      '选择实验组和指标即可对比；完整指标与生成结果可按需展开。',
    testScenarios: '测试场景',
    testScenariosDetail:
      '所有实验复用相同输入，覆盖信息卡、购买卡和长内容规划。',
    complexitySuffix: '复杂度',
    interaction: '交互',
    methodIndex: '04 · 实验方法',
    interpretation: '结果解读',
    limitationsTitle: '阅读结果前，请注意',
  },
  'en-US': {
    metricTabs: [
      {
        key: 'totalTokens',
        label: 'Tokens',
        description: 'Total tokens · lower is better',
      },
      {
        key: 'agentMs',
        label: 'Agent latency',
        description: 'Agent generation latency · lower is better',
      },
      {
        key: 'judge',
        label: 'UI Judge',
        description: 'UI Judge score · higher is better',
      },
    ],
    experimentLabels: {
      models: 'A · Model',
      prompts: 'B · System Prompt',
      catalogs: 'C · Catalog',
    },
    fullMetrics: 'Full metrics',
    fullMetricsSummary:
      'Tokens · Agent latency · Runtime · UI Judge · Attempts',
    agentLatency: 'Agent latency',
    generationAttempts: 'Attempts',
    viewEvidence: 'View generated-result collage',
    viewAllEvidence: 'View all three experiment result sets',
    evidenceKinds: 'Model · System Prompt · Catalog',
    open: 'Open',
    evidenceDialogTitle: 'Three experiment result sets',
    evidenceDialogHint: 'Open an image to view it at full size.',
    closeEvidenceAria: 'Close experiment results',
    close: 'Close',
    chooseEvidenceAria: 'Choose experiment results',
    chooseExperimentAria: 'Choose experiment',
    chooseMetricAria: 'Choose metric',
    currentExperiment: 'Current experiment',
    fixedCondition: 'Fixed condition',
    scenarioAverage: (count: number) => `Average across ${count} scenarios`,
    metricBest: 'Best for this metric',
    groupRecommendation: 'Group recommendation · overall',
    whyRecommended: 'Why it is recommended',
    caveat: 'What to consider',
    dataRevision: (revision: number, runs: number) =>
      `Data revision ${revision} · ${runs} runs`,
    phaseResults: 'Phase 1 benchmark results',
    phaseConclusion: 'Phase 1 conclusion',
    scopeAria: 'Experiment scope',
    runs: 'Runs',
    scenarios: 'Scenarios',
    models: 'Models',
    evidenceBoundary: 'Evidence boundary',
    evidenceBoundaryDetail:
      'This is not a validated optimal combination. The recommendation comes from three single-variable experiments; the three choices have not yet been tested together.',
    keyResults: 'Key results',
    keyResultsDetail: (count: number) =>
      `${count} key results from the Model, System Prompt, and Catalog experiments.`,
    experimentComparison: 'Experiment comparison',
    experimentComparisonDetail:
      'Choose an experiment and metric to compare results; expand full metrics and generated results when needed.',
    testScenarios: 'Test scenarios',
    testScenariosDetail:
      'Every experiment reuses the same inputs across an information card, a purchase card, and long-form planning.',
    complexitySuffix: ' complexity',
    interaction: 'Interaction',
    methodIndex: '04 · Methodology',
    interpretation: 'Interpreting the results',
    limitationsTitle: 'Before reading the results',
  },
} as const satisfies Record<
  BenchLocale,
  {
    metricTabs: readonly {
      key: DisplayMetric;
      label: string;
      description: string;
    }[];
    experimentLabels: Record<BenchComparison['id'], string>;
    fullMetrics: string;
    fullMetricsSummary: string;
    agentLatency: string;
    generationAttempts: string;
    viewEvidence: string;
    viewAllEvidence: string;
    evidenceKinds: string;
    open: string;
    evidenceDialogTitle: string;
    evidenceDialogHint: string;
    closeEvidenceAria: string;
    close: string;
    chooseEvidenceAria: string;
    chooseExperimentAria: string;
    chooseMetricAria: string;
    currentExperiment: string;
    fixedCondition: string;
    scenarioAverage: (count: number) => string;
    metricBest: string;
    groupRecommendation: string;
    whyRecommended: string;
    caveat: string;
    dataRevision: (revision: number, runs: number) => string;
    phaseResults: string;
    phaseConclusion: string;
    scopeAria: string;
    runs: string;
    scenarios: string;
    models: string;
    evidenceBoundary: string;
    evidenceBoundaryDetail: string;
    keyResults: string;
    keyResultsDetail: (count: number) => string;
    experimentComparison: string;
    experimentComparisonDetail: string;
    testScenarios: string;
    testScenariosDetail: string;
    complexitySuffix: string;
    interaction: string;
    methodIndex: string;
    interpretation: string;
    limitationsTitle: string;
  }
>;

function getEvidence(
  locale: BenchLocale,
  scope: PhaseOneBench['scope'],
): Record<
  BenchComparison['id'],
  { description: string; src: string; title: string }
> {
  if (locale === 'en-US') {
    return {
      models: {
        title: 'Model comparison result collage',
        description: `${scope.models} models × ${scope.scenarios} scenarios`,
        src: MODEL_EVIDENCE_URL,
      },
      prompts: {
        title: 'System Prompt comparison result collage',
        description: `${scope.prompts} Prompts × ${scope.scenarios} scenarios`,
        src: PROMPT_EVIDENCE_URL,
      },
      catalogs: {
        title: 'Catalog comparison result collage',
        description:
          `${scope.catalogs} Catalogs × ${scope.scenarios} scenarios`,
        src: CATALOG_EVIDENCE_URL,
      },
    };
  }

  return {
    models: {
      title: '模型对比结果拼图',
      description: `${scope.models} 个模型 × ${scope.scenarios} 个场景`,
      src: MODEL_EVIDENCE_URL,
    },
    prompts: {
      title: 'System Prompt 对比结果拼图',
      description: `${scope.prompts} 个 Prompt × ${scope.scenarios} 个场景`,
      src: PROMPT_EVIDENCE_URL,
    },
    catalogs: {
      title: 'Catalog 对比结果拼图',
      description: `${scope.catalogs} 种 Catalog × ${scope.scenarios} 个场景`,
      src: CATALOG_EVIDENCE_URL,
    },
  };
}

function formatMetric(metric: DisplayMetric, value: number): string {
  if (metric === 'totalTokens') {
    return NUMBER_FORMATTER.format(Math.round(value));
  }
  if (metric === 'agentMs') {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${value.toFixed(1)} / 5`;
}

function formatMilliseconds(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
}

function moveTabFocus(event: KeyboardEvent<HTMLButtonElement>) {
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
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
  }

  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function FullMetrics(props: {
  comparison: BenchComparison;
  locale: BenchLocale;
}) {
  const copy = UI_COPY[props.locale];

  return (
    <details className='benchStudyDisclosure'>
      <summary>
        <span>{copy.fullMetrics}</span>
        <small>{copy.fullMetricsSummary}</small>
      </summary>
      <div className='benchStudyMetricsTableWrap'>
        <table className='benchStudyMetricsTable'>
          <thead>
            <tr>
              <th scope='col'>{props.comparison.variable}</th>
              <th scope='col'>Tokens</th>
              <th scope='col'>{copy.agentLatency}</th>
              <th scope='col'>Render</th>
              <th scope='col'>FMP</th>
              <th scope='col'>TTI</th>
              <th scope='col'>UI Judge</th>
              <th scope='col'>{copy.generationAttempts}</th>
            </tr>
          </thead>
          <tbody>
            {props.comparison.rows.map((row) => (
              <tr key={row.id}>
                <th scope='row'>{row.name}</th>
                <td>{NUMBER_FORMATTER.format(row.metrics.totalTokens)}</td>
                <td>{formatMilliseconds(row.metrics.agentMs)}</td>
                <td>{formatMilliseconds(row.metrics.renderMs)}</td>
                <td>{formatMilliseconds(row.metrics.fmpMs)}</td>
                <td>{formatMilliseconds(row.metrics.ttiMs)}</td>
                <td>{row.metrics.judge.toFixed(1)} / 5</td>
                <td>{row.metrics.attempts.toFixed(1)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EvidenceDisclosure(props: {
  experimentId: BenchComparison['id'];
  locale: BenchLocale;
  scope: PhaseOneBench['scope'];
}) {
  const copy = UI_COPY[props.locale];
  const evidence = getEvidence(props.locale, props.scope)[props.experimentId];

  return (
    <details
      className='benchStudyDisclosure benchStudyEvidence'
      key={props.experimentId}
    >
      <summary>
        <span>{copy.viewEvidence}</span>
        <small>{evidence.description}</small>
      </summary>
      <a href={evidence.src} target='_blank' rel='noreferrer'>
        <img
          src={evidence.src}
          alt={`${evidence.title}${
            props.locale === 'zh-CN' ? '：' : ': '
          }${evidence.description}`}
          loading='lazy'
        />
      </a>
    </details>
  );
}

function ScenarioEvidenceGallery(props: {
  locale: BenchLocale;
  scope: PhaseOneBench['scope'];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [evidenceId, setEvidenceId] = useState<BenchComparison['id']>('models');
  const copy = UI_COPY[props.locale];
  const evidenceCollection = getEvidence(props.locale, props.scope);
  const evidence = evidenceCollection[evidenceId];

  return (
    <>
      <button
        className='benchStudyScenarioEvidenceTrigger'
        type='button'
        onClick={() => dialogRef.current?.showModal()}
      >
        <span>
          <strong>{copy.viewAllEvidence}</strong>
          <small>{copy.evidenceKinds}</small>
        </span>
        <span aria-hidden='true'>{copy.open}</span>
      </button>

      <dialog
        className='benchStudyEvidenceDialog'
        ref={dialogRef}
        aria-labelledby='bench-study-evidence-title'
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
        <div className='benchStudyEvidenceDialogPanel'>
          <header className='benchStudyEvidenceDialogHeader'>
            <div>
              <h3 id='bench-study-evidence-title'>
                {copy.evidenceDialogTitle}
              </h3>
              <p>{copy.evidenceDialogHint}</p>
            </div>
            <button
              type='button'
              aria-label={copy.closeEvidenceAria}
              onClick={() => dialogRef.current?.close()}
            >
              {copy.close}
            </button>
          </header>
          <div
            className='benchStudyEvidenceDialogTabs'
            role='tablist'
            aria-label={copy.chooseEvidenceAria}
          >
            {(Object.keys(evidenceCollection) as BenchComparison['id'][]).map(
              (id) => (
                <button
                  id={`bench-study-evidence-${id}`}
                  type='button'
                  role='tab'
                  aria-controls='bench-study-evidence-panel'
                  aria-selected={evidenceId === id}
                  tabIndex={evidenceId === id ? 0 : -1}
                  onClick={() => setEvidenceId(id)}
                  onKeyDown={moveTabFocus}
                  key={id}
                >
                  {copy.experimentLabels[id]}
                </button>
              ),
            )}
          </div>
          <figure
            className='benchStudyEvidenceDialogFigure'
            id='bench-study-evidence-panel'
            role='tabpanel'
            aria-labelledby={`bench-study-evidence-${evidenceId}`}
          >
            <a href={evidence.src} target='_blank' rel='noreferrer'>
              <img
                src={evidence.src}
                alt={`${evidence.title}${
                  props.locale === 'zh-CN' ? '：' : ': '
                }${evidence.description}`}
                loading='lazy'
              />
            </a>
            <figcaption>
              <strong>{evidence.title}</strong>
              <span>{evidence.description}</span>
            </figcaption>
          </figure>
        </div>
      </dialog>
    </>
  );
}

function ExperimentComparator(props: {
  comparisons: readonly BenchComparison[];
  locale: BenchLocale;
  scope: PhaseOneBench['scope'];
}) {
  const copy = UI_COPY[props.locale];
  const metricTabs = copy.metricTabs;
  const [experimentId, setExperimentId] = useState<
    BenchComparison['id']
  >('prompts');
  const [metric, setMetric] = useState<DisplayMetric>('totalTokens');
  const comparison = props.comparisons.find(
    (item) => item.id === experimentId,
  ) ?? props.comparisons[0];
  const winner = comparison.rows.find((row) => row.tone === 'positive')
    ?? comparison.rows[0];
  const metricDefinition = metricTabs.find((item) => item.key === metric)
    ?? metricTabs[0];
  const values = comparison.rows.map((row) => row.metrics[metric]);
  const maximum = metric === 'judge' ? 5 : Math.max(...values);
  const bestValue = metric === 'judge'
    ? Math.max(...values)
    : Math.min(...values);

  return (
    <div className='benchStudyCompareShell'>
      <div className='benchStudyCompareToolbar'>
        <div
          className='benchStudyTabs'
          role='tablist'
          aria-label={copy.chooseExperimentAria}
        >
          {props.comparisons.map((item) => (
            <button
              id={`bench-experiment-${item.id}`}
              type='button'
              role='tab'
              aria-controls='bench-experiment-panel'
              aria-selected={item.id === comparison.id}
              tabIndex={item.id === comparison.id ? 0 : -1}
              onClick={() => setExperimentId(item.id)}
              onKeyDown={moveTabFocus}
              key={item.id}
            >
              {copy.experimentLabels[item.id]}
            </button>
          ))}
        </div>
        <div
          className='benchStudyTabs benchStudyMetricTabs'
          role='tablist'
          aria-label={copy.chooseMetricAria}
        >
          {metricTabs.map((item) => (
            <button
              id={`bench-metric-${item.key}`}
              type='button'
              role='tab'
              aria-controls='bench-experiment-panel'
              aria-selected={item.key === metric}
              tabIndex={item.key === metric ? 0 : -1}
              onClick={() => setMetric(item.key)}
              onKeyDown={moveTabFocus}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className='benchStudyCompareBody'
        id='bench-experiment-panel'
        role='tabpanel'
        aria-labelledby={`bench-experiment-${comparison.id} bench-metric-${metric}`}
      >
        <div className='benchStudyCompareHeader' aria-live='polite'>
          <div>
            <span>{copy.currentExperiment}</span>
            <h3>{comparison.title}</h3>
          </div>
          <p>
            <small>{copy.fixedCondition}</small>
            {comparison.fixedCondition}
          </p>
        </div>

        <div className='benchStudyBars' aria-live='polite'>
          <div className='benchStudyBarsHeading'>
            <span>{metricDefinition.description}</span>
            <small>{copy.scenarioAverage(props.scope.scenarios)}</small>
          </div>
          {comparison.rows.map((row) => {
            const value = row.metrics[metric];
            const isBest = value === bestValue;
            const width = Math.max(7, Math.min(100, (value / maximum) * 100));

            return (
              <div
                className={`benchStudyBarRow${isBest ? ' isBest' : ''}`}
                key={row.id}
              >
                <div className='benchStudyBarLabel'>
                  <strong>{row.name}</strong>
                  {isBest ? <small>{copy.metricBest}</small> : null}
                </div>
                <div className='benchStudyBarTrack' aria-hidden='true'>
                  <span style={{ width: `${width}%` }} />
                </div>
                <output>{formatMetric(metric, value)}</output>
              </div>
            );
          })}
        </div>

        <aside className='benchStudyWinner' aria-live='polite'>
          <div className='benchStudyWinnerLead'>
            <small>{copy.groupRecommendation}</small>
            <strong>{winner.name}</strong>
            <span>{winner.descriptor}</span>
          </div>
          <div>
            <small>{copy.whyRecommended}</small>
            <p>{winner.strength}</p>
          </div>
          <div>
            <small>{copy.caveat}</small>
            <p>{winner.risk}</p>
          </div>
        </aside>
      </div>

      <div className='benchStudyCompareDetails'>
        <FullMetrics comparison={comparison} locale={props.locale} />
        <EvidenceDisclosure
          experimentId={comparison.id}
          locale={props.locale}
          scope={props.scope}
        />
      </div>
    </div>
  );
}

export interface BenchResultPageProps {
  locale?: BenchLocale;
}

export function BenchResultPage({
  locale = 'zh-CN',
}: BenchResultPageProps) {
  const report = getPhaseOneBench(locale);
  const copy = UI_COPY[locale];

  return (
    <main className='benchStudyPage' lang={locale}>
      <section className='benchStudyHero'>
        <div className='benchStudyHeroTopline'>
          <span>{report.eyebrow}</span>
          <span>
            {copy.dataRevision(
              report.sourceRevision,
              report.scope.runs,
            )}
          </span>
        </div>

        <div className='benchStudyHeroLead'>
          <p className='benchStudyEyebrow'>{copy.phaseResults}</p>
          <h1>{report.title}</h1>
          <div className='benchStudyConclusion'>
            <span>{copy.phaseConclusion}</span>
            <p>{report.conclusion}</p>
          </div>
          <p className='benchStudyHeroContext'>{report.description}</p>
        </div>

        <dl className='benchStudyScope' aria-label={copy.scopeAria}>
          <div>
            <dt>{copy.runs}</dt>
            <dd>{report.scope.runs}</dd>
          </div>
          <div>
            <dt>{copy.scenarios}</dt>
            <dd>{report.scope.scenarios}</dd>
          </div>
          <div>
            <dt>{copy.models}</dt>
            <dd>{report.scope.models}</dd>
          </div>
          <div>
            <dt>Prompt / Catalog</dt>
            <dd>{report.scope.prompts} / {report.scope.catalogs}</dd>
          </div>
        </dl>

        <div className='benchStudyRecommendation'>
          <div className='benchStudyRecommendationLead'>
            <span>{report.recommendation.title}</span>
            <p>{report.recommendation.summary}</p>
          </div>
          <ol>
            {report.recommendation.combination.map((item) => (
              <li key={item.dimension}>
                <small>{item.dimension}</small>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ol>
          <p className='benchStudyEvidenceBoundary'>
            <strong>{copy.evidenceBoundary}</strong>
            {copy.evidenceBoundaryDetail}
          </p>
        </div>
      </section>

      <section className='benchStudySection benchStudyFindings'>
        <header className='benchStudySectionHeader'>
          <span>01</span>
          <div>
            <h2>{copy.keyResults}</h2>
            <p>{copy.keyResultsDetail(report.highlights.length)}</p>
          </div>
        </header>
        <div className='benchStudyFindingList'>
          {report.highlights.map((highlight, index) => (
            <article
              className='benchStudyFinding'
              key={highlight.id}
            >
              <div className='benchStudyFindingTitle'>
                <span>0{index + 1}</span>
                <h3>{highlight.title}</h3>
              </div>
              <div className='benchStudyFindingResult'>
                <strong>{highlight.subject}</strong>
                <p>{highlight.detail}</p>
              </div>
              <div className='benchStudyFindingMetric'>
                <strong>{highlight.value}</strong>
                <small>{highlight.metricLabel}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className='benchStudySection benchStudyExperiments'>
        <header className='benchStudySectionHeader'>
          <span>02</span>
          <div>
            <h2>{copy.experimentComparison}</h2>
            <p>{copy.experimentComparisonDetail}</p>
          </div>
        </header>
        <ExperimentComparator
          comparisons={report.comparisons}
          locale={locale}
          scope={report.scope}
        />
      </section>

      <section className='benchStudySection benchStudyScenarios'>
        <header className='benchStudySectionHeader'>
          <span>03</span>
          <div>
            <h2>{copy.testScenarios}</h2>
            <p>{copy.testScenariosDetail}</p>
          </div>
        </header>
        <div className='benchStudyScenarioList'>
          {report.scenarios.map((scenario, index) => (
            <article
              className='benchStudyScenario'
              key={scenario.id}
            >
              <div className='benchStudyScenarioTitle'>
                <span>0{index + 1}</span>
                <div>
                  <h3>{scenario.name}</h3>
                  <small>
                    {scenario.businessMode} · {scenario.complexity}
                    {copy.complexitySuffix}
                  </small>
                </div>
              </div>
              <p>{scenario.purpose}</p>
              <footer>
                <span>{copy.interaction}</span>
                <b>{scenario.interaction}</b>
              </footer>
            </article>
          ))}
        </div>
        <ScenarioEvidenceGallery locale={locale} scope={report.scope} />
      </section>

      <section className='benchStudySection benchStudyMethod'>
        <div className='benchStudyMethodColumn'>
          <span className='benchStudySectionIndex'>{copy.methodIndex}</span>
          <h2>{report.methodology.title}</h2>
          <ol className='benchStudyMethodList'>
            {report.methodology.items.map((item, index) => (
              <li key={item.id}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <aside className='benchStudyLimitations'>
          <span className='benchStudySectionIndex'>{copy.interpretation}</span>
          <h2>{copy.limitationsTitle}</h2>
          <ol>
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ol>
        </aside>
      </section>

      <footer className='benchStudyFooter'>
        <span>Lynx A2UI Bench · Phase 1</span>
        <nav aria-label='Bench report links'>
          <a href='#/bench'>Runner</a>
          <a href='#/bench/phase-1' aria-current='page'>Phase 1</a>
          <a href='#/bench/phase-2'>Phase 2</a>
        </nav>
      </footer>
    </main>
  );
}
