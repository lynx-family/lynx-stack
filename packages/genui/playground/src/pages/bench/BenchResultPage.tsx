// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import type { BenchComparison, BenchMetricKey } from './phaseOne.js';
import { PHASE_ONE_BENCH } from './phaseOne.js';
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

const METRIC_TABS = [
  {
    key: 'totalTokens',
    label: 'Tokens',
    description: 'Total tokens · lower is better',
  },
  {
    key: 'agentMs',
    label: 'Agent',
    description: 'Generation latency · lower is better',
  },
  {
    key: 'judge',
    label: 'UI Judge',
    description: 'Visual correctness · higher is better',
  },
] as const satisfies readonly {
  key: DisplayMetric;
  label: string;
  description: string;
}[];

const EXPERIMENT_LABELS = {
  models: 'A · LLM',
  prompts: 'B · Prompt',
  catalogs: 'C · Catalog',
} as const satisfies Record<BenchComparison['id'], string>;

const EVIDENCE = {
  models: {
    title: 'Model comparison contact sheet',
    description: '4 models × 3 scenarios',
    src: MODEL_EVIDENCE_URL,
  },
  prompts: {
    title: 'Prompt comparison contact sheet',
    description: '3 prompt variants × 3 scenarios',
    src: PROMPT_EVIDENCE_URL,
  },
  catalogs: {
    title: 'Catalog comparison contact sheet',
    description: '3 catalog sizes × 3 scenarios',
    src: CATALOG_EVIDENCE_URL,
  },
} as const satisfies Record<
  BenchComparison['id'],
  { title: string; description: string; src: string }
>;

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

function FullMetrics(props: { comparison: BenchComparison }) {
  return (
    <details className='benchStudyDisclosure'>
      <summary>
        <span>完整指标</span>
        <small>Tokens · Agent · Runtime · Judge · Attempts</small>
      </summary>
      <div className='benchStudyMetricsTableWrap'>
        <table className='benchStudyMetricsTable'>
          <thead>
            <tr>
              <th scope='col'>{props.comparison.variable}</th>
              <th scope='col'>Tokens</th>
              <th scope='col'>Agent</th>
              <th scope='col'>Render</th>
              <th scope='col'>FMP</th>
              <th scope='col'>TTI</th>
              <th scope='col'>Judge</th>
              <th scope='col'>Attempts</th>
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
}) {
  const evidence = EVIDENCE[props.experimentId];

  return (
    <details
      className='benchStudyDisclosure benchStudyEvidence'
      key={props.experimentId}
    >
      <summary>
        <span>查看当前实验的视觉证据</span>
        <small>{evidence.description}</small>
      </summary>
      <a href={evidence.src} target='_blank' rel='noreferrer'>
        <img
          src={evidence.src}
          alt={`${evidence.title}: ${evidence.description}`}
          loading='lazy'
        />
      </a>
    </details>
  );
}

function ExperimentComparator(props: {
  comparisons: readonly BenchComparison[];
}) {
  const [experimentId, setExperimentId] = useState<
    BenchComparison['id']
  >('prompts');
  const [metric, setMetric] = useState<DisplayMetric>('totalTokens');
  const comparison = props.comparisons.find(
    (item) => item.id === experimentId,
  ) ?? props.comparisons[0];
  const winner = comparison.rows.find((row) => row.tone === 'positive')
    ?? comparison.rows[0];
  const metricDefinition = METRIC_TABS.find((item) => item.key === metric)
    ?? METRIC_TABS[0];
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
          aria-label='选择实验'
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
              {EXPERIMENT_LABELS[item.id]}
            </button>
          ))}
        </div>
        <div
          className='benchStudyTabs benchStudyMetricTabs'
          role='tablist'
          aria-label='选择指标'
        >
          {METRIC_TABS.map((item) => (
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
        <div className='benchStudyCompareSummary' aria-live='polite'>
          <div>
            <span>{comparison.fixedCondition}</span>
            <h3>{comparison.title}</h3>
            <p>{winner.strength}</p>
          </div>
          <div className='benchStudyWinner'>
            <small>综合建议 · 跨指标</small>
            <strong>{winner.name}</strong>
            <span>{winner.descriptor}</span>
          </div>
        </div>

        <div className='benchStudyBars' aria-live='polite'>
          <div className='benchStudyBarsHeading'>
            <span>{metricDefinition.description}</span>
            <small>Average across 3 scenarios</small>
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
                  {isBest ? <small>BEST</small> : null}
                </div>
                <div className='benchStudyBarTrack' aria-hidden='true'>
                  <span style={{ width: `${width}%` }} />
                </div>
                <output>{formatMetric(metric, value)}</output>
              </div>
            );
          })}
        </div>
      </div>

      <div className='benchStudyCompareDetails'>
        <FullMetrics comparison={comparison} />
        <EvidenceDisclosure experimentId={comparison.id} />
      </div>
    </div>
  );
}

export function BenchResultPage() {
  const report = PHASE_ONE_BENCH;

  return (
    <main className='benchStudyPage'>
      <section className='benchStudyHero'>
        <div className='benchStudyHeroTopline'>
          <span>Protocol Laboratory · Published report</span>
          <span>Rev. {report.sourceRevision} · {report.scope.runs} runs</span>
        </div>

        <div className='benchStudyHeroGrid'>
          <div>
            <p className='benchStudyEyebrow'>Lynx A2UI benchmark</p>
            <h1>
              <span>BENCH</span>
              <span>/01</span>
            </h1>
          </div>
          <div className='benchStudyHeroCopy'>
            <p className='benchStudyThesis'>{report.conclusion}</p>
            <p className='benchStudyHeroContext'>{report.description}</p>
            <div className='benchStudyHeroActions'>
              <a href='#/bench'>返回 Runner</a>
              <a href='#/bench/phase-2'>Phase 02 计划 ↗</a>
            </div>
          </div>
        </div>

        <div className='benchStudyRecommendation'>
          <span>Recommended baseline</span>
          <ol>
            {report.recommendation.combination.map((item) => (
              <li key={item.dimension}>
                <small>{item.dimension}</small>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ol>
          <p>
            {report.recommendation.summary}
            <small>来自三组单变量实验的外推；该组合尚未联测。</small>
          </p>
        </div>
      </section>

      <section className='benchStudySection benchStudyFindings'>
        <header className='benchStudySectionHeader'>
          <span>01 / Findings</span>
          <div>
            <h2>
              先看结论，<br />再看证据。
            </h2>
            <p>一期实验收敛成四个可以直接带走的数字。</p>
          </div>
        </header>
        <div className='benchStudyFindingGrid'>
          {report.highlights.map((highlight, index) => (
            <article
              className={`benchStudyFinding tone-${index + 1}`}
              key={highlight.id}
            >
              <div>
                <span>{highlight.title}</span>
                <small>{highlight.metricLabel}</small>
              </div>
              <strong>{highlight.value}</strong>
              <footer>
                <b>{highlight.subject}</b>
                <p>{highlight.detail}</p>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className='benchStudySection benchStudyExperiments'>
        <header className='benchStudySectionHeader'>
          <span>02 / Experiments</span>
          <div>
            <h2>
              三组实验，<br />一个选择器。
            </h2>
            <p>
              每次只比较一个变量和一个指标；完整数据与截图按需展开。
            </p>
          </div>
        </header>
        <ExperimentComparator comparisons={report.comparisons} />
      </section>

      <section className='benchStudySection benchStudyScenarios'>
        <header className='benchStudySectionHeader'>
          <span>03 / Scenarios</span>
          <div>
            <h2>
              三种复杂度，<br />同一把尺。
            </h2>
            <p>从轻量信息卡到长内容规划，固定输入让变量之间可比较。</p>
          </div>
        </header>
        <div className='benchStudyScenarioGrid'>
          {report.scenarios.map((scenario, index) => (
            <article
              className={`benchStudyScenario tone-${index + 1}`}
              key={scenario.id}
            >
              <div>
                <span>0{index + 1}</span>
                <small>{scenario.complexity}复杂度</small>
              </div>
              <h3>{scenario.name}</h3>
              <p>{scenario.purpose}</p>
              <footer>
                <span>{scenario.businessMode}</span>
                <b>{scenario.interaction}</b>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className='benchStudySection benchStudyMethod'>
        <div className='benchStudyMethodColumn'>
          <span className='benchStudySectionIndex'>04 / Method</span>
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
          <span className='benchStudySectionIndex'>Read with care</span>
          <h2>三个限制</h2>
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
