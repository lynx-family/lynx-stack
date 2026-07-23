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
] as const satisfies readonly {
  key: DisplayMetric;
  label: string;
  description: string;
}[];

const EXPERIMENT_LABELS = {
  models: 'A · 模型',
  prompts: 'B · System Prompt',
  catalogs: 'C · Catalog',
} as const satisfies Record<BenchComparison['id'], string>;

const EVIDENCE = {
  models: {
    title: '模型对比结果拼图',
    description: '4 个模型 × 3 个场景',
    src: MODEL_EVIDENCE_URL,
  },
  prompts: {
    title: 'System Prompt 对比结果拼图',
    description: '3 个 Prompt × 3 个场景',
    src: PROMPT_EVIDENCE_URL,
  },
  catalogs: {
    title: 'Catalog 对比结果拼图',
    description: '3 种 Catalog × 3 个场景',
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
        <small>Tokens · Agent 耗时 · Runtime · UI Judge · 生成次数</small>
      </summary>
      <div className='benchStudyMetricsTableWrap'>
        <table className='benchStudyMetricsTable'>
          <thead>
            <tr>
              <th scope='col'>{props.comparison.variable}</th>
              <th scope='col'>Tokens</th>
              <th scope='col'>Agent 耗时</th>
              <th scope='col'>Render</th>
              <th scope='col'>FMP</th>
              <th scope='col'>TTI</th>
              <th scope='col'>UI Judge</th>
              <th scope='col'>生成次数</th>
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
        <span>查看生成结果拼图</span>
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
        <div className='benchStudyCompareHeader' aria-live='polite'>
          <div>
            <span>当前实验</span>
            <h3>{comparison.title}</h3>
          </div>
          <p>
            <small>固定条件</small>
            {comparison.fixedCondition}
          </p>
        </div>

        <div className='benchStudyBars' aria-live='polite'>
          <div className='benchStudyBarsHeading'>
            <span>{metricDefinition.description}</span>
            <small>3 个场景的平均值</small>
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
                  {isBest ? <small>该指标最佳</small> : null}
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
            <small>本组建议 · 综合指标</small>
            <strong>{winner.name}</strong>
            <span>{winner.descriptor}</span>
          </div>
          <div>
            <small>为什么推荐</small>
            <p>{winner.strength}</p>
          </div>
          <div>
            <small>需要注意</small>
            <p>{winner.risk}</p>
          </div>
        </aside>
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
          <span>{report.eyebrow}</span>
          <span>
            数据版本 Rev. {report.sourceRevision} · {report.scope.runs} 次运行
          </span>
        </div>

        <div className='benchStudyHeroLead'>
          <p className='benchStudyEyebrow'>一期测评结果</p>
          <h1>{report.title}</h1>
          <div className='benchStudyConclusion'>
            <span>一期结论</span>
            <p>{report.conclusion}</p>
          </div>
          <p className='benchStudyHeroContext'>{report.description}</p>
          <div className='benchStudyHeroActions'>
            <a href='#/bench'>打开 Runner</a>
            <a href='#/bench/phase-2'>查看 Phase 02 计划</a>
          </div>
        </div>

        <dl className='benchStudyScope' aria-label='实验范围'>
          <div>
            <dt>运行</dt>
            <dd>{report.scope.runs}</dd>
          </div>
          <div>
            <dt>场景</dt>
            <dd>{report.scope.scenarios}</dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{report.scope.models}</dd>
          </div>
          <div>
            <dt>Prompt / Catalog</dt>
            <dd>{report.scope.prompts} / {report.scope.catalogs}</dd>
          </div>
        </dl>

        <div className='benchStudyRecommendation'>
          <div className='benchStudyRecommendationLead'>
            <span>建议起始配置</span>
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
            <strong>证据边界</strong>
            这不是已经验证的最优组合：推荐来自三组单变量实验，三者尚未一起测试。
          </p>
        </div>
      </section>

      <section className='benchStudySection benchStudyFindings'>
        <header className='benchStudySectionHeader'>
          <span>01</span>
          <div>
            <h2>关键结果</h2>
            <p>
              从模型、System Prompt 和 Catalog 三组实验中，摘取 4 个关键结果。
            </p>
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
            <h2>实验对比</h2>
            <p>选择实验组和指标即可对比；完整指标与生成结果可按需展开。</p>
          </div>
        </header>
        <ExperimentComparator comparisons={report.comparisons} />
      </section>

      <section className='benchStudySection benchStudyScenarios'>
        <header className='benchStudySectionHeader'>
          <span>03</span>
          <div>
            <h2>测试场景</h2>
            <p>所有实验复用相同输入，覆盖信息卡、购买卡和长内容规划。</p>
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
                    {scenario.businessMode} · {scenario.complexity}复杂度
                  </small>
                </div>
              </div>
              <p>{scenario.purpose}</p>
              <footer>
                <span>交互</span>
                <b>{scenario.interaction}</b>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className='benchStudySection benchStudyMethod'>
        <div className='benchStudyMethodColumn'>
          <span className='benchStudySectionIndex'>04 · 实验方法</span>
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
          <span className='benchStudySectionIndex'>结果解读</span>
          <h2>阅读结果前，请注意</h2>
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
