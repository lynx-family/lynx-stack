// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchLocale } from './benchLocale.js';

export type BenchMetricKey =
  | 'totalTokens'
  | 'agentMs'
  | 'renderMs'
  | 'fmpMs'
  | 'ttiMs'
  | 'judge'
  | 'attempts'
  | 'success';

export type BenchTone = 'accent' | 'positive' | 'warning' | 'neutral';

export interface BenchMetrics {
  totalTokens: number;
  agentMs: number;
  renderMs: number;
  fmpMs: number;
  ttiMs: number;
  judge: number;
  attempts: number;
  /** Successful runs as a percentage from 0 to 100. */
  success: number;
}

export interface BenchMetricDefinition {
  key: BenchMetricKey;
  label: string;
  unit: 'tokens' | 'ms' | 'score' | 'attempts' | 'percent';
  direction: 'lower' | 'higher';
  precision: number;
}

export interface BenchComparisonRow {
  id: string;
  name: string;
  tone?: BenchTone;
  descriptor: string;
  strength: string;
  risk: string;
  metrics: BenchMetrics;
}

export interface BenchComparison {
  id: 'models' | 'prompts' | 'catalogs';
  title: string;
  variable: string;
  fixedCondition: string;
  primaryMetrics: readonly BenchMetricKey[];
  rows: readonly BenchComparisonRow[];
}

export interface BenchHighlight {
  id: string;
  title: string;
  value: string;
  metricLabel: string;
  subject: string;
  detail: string;
  tone: BenchTone;
}

export interface BenchScenario {
  id: string;
  name: string;
  businessMode: string;
  complexity: 'High' | 'Low' | 'Medium' | '低' | '中' | '高';
  interaction: string;
  prompt: string;
  purpose: string;
}

export interface BenchMethodItem {
  id: string;
  title: string;
  detail: string;
}

export interface BenchRecommendation {
  title: string;
  summary: string;
  combination: readonly {
    dimension: 'Catalog' | 'Model' | 'Prompt' | '模型';
    comparisonId: string;
    label: string;
  }[];
}

export interface PhaseOneBench {
  slug: 'phase-1';
  sourceRevision: number;
  eyebrow: string;
  title: string;
  description: string;
  conclusion: string;
  scope: {
    runs: number;
    scenarios: number;
    models: number;
    prompts: number;
    catalogs: number;
  };
  metricDefinitions: readonly BenchMetricDefinition[];
  highlights: readonly BenchHighlight[];
  recommendation: BenchRecommendation;
  comparisons: readonly BenchComparison[];
  scenarios: readonly BenchScenario[];
  methodology: {
    title: string;
    sequence: readonly string[];
    items: readonly BenchMethodItem[];
  };
  limitations: readonly string[];
}

export const PHASE_ONE_BENCH = {
  slug: 'phase-1',
  sourceRevision: 1238,
  eyebrow: 'Lynx A2UI Bench · Phase 01',
  title: '模型、System Prompt 与 Catalog，怎么选？',
  description:
    '测试覆盖 3 类移动端 A2UI 场景。每组实验只替换一个变量，并用同一套指标记录生成成本、耗时、稳定性和视觉正确性。',
  conclusion:
    '模型组中，gpt-5.5 的平均 Tokens 最少；Prompt 组中，Token Efficient 的综合表现最均衡；Catalog 组中，Minimal Catalog 的 Tokens 和 UI Judge 得分领先，但 Agent 耗时并不占优。',
  scope: {
    runs: 30,
    scenarios: 3,
    models: 3,
    prompts: 3,
    catalogs: 3,
  },
  metricDefinitions: [
    {
      key: 'totalTokens',
      label: 'Tokens',
      unit: 'tokens',
      direction: 'lower',
      precision: 0,
    },
    {
      key: 'agentMs',
      label: 'Agent 耗时',
      unit: 'ms',
      direction: 'lower',
      precision: 0,
    },
    {
      key: 'renderMs',
      label: 'Render',
      unit: 'ms',
      direction: 'lower',
      precision: 1,
    },
    {
      key: 'fmpMs',
      label: 'FMP',
      unit: 'ms',
      direction: 'lower',
      precision: 1,
    },
    {
      key: 'ttiMs',
      label: 'TTI',
      unit: 'ms',
      direction: 'lower',
      precision: 1,
    },
    {
      key: 'judge',
      label: 'UI Judge',
      unit: 'score',
      direction: 'higher',
      precision: 1,
    },
    {
      key: 'attempts',
      label: '生成次数',
      unit: 'attempts',
      direction: 'lower',
      precision: 1,
    },
    {
      key: 'success',
      label: 'Success',
      unit: 'percent',
      direction: 'higher',
      precision: 0,
    },
  ],
  highlights: [
    {
      id: 'lowest-model-cost',
      title: '模型：平均 Tokens 最少',
      value: '9.3k',
      metricLabel: '平均 Tokens',
      subject: 'gpt-5.5-2026-04-24',
      detail: '在模型对比组中，平均 Tokens 最少；UI Judge 得分并列最高。',
      tone: 'neutral',
    },
    {
      id: 'fastest-model',
      title: '模型：Agent 耗时最短',
      value: '13.9s',
      metricLabel: '平均 Agent 耗时',
      subject: 'deepseek-coder',
      detail: '在模型对比组中，平均 Agent 耗时最短，但 Tokens 高于 gpt-5.5。',
      tone: 'neutral',
    },
    {
      id: 'best-prompt',
      title: 'System Prompt：综合最佳',
      value: '4.0 / 5',
      metricLabel: 'UI Judge 得分',
      subject: 'Token Efficient',
      detail: '平均 Tokens 8.3k，Agent 耗时 24.4s；三项主指标均优于对照组。',
      tone: 'positive',
    },
    {
      id: 'best-catalog',
      title: 'Catalog：Tokens 与 UI Judge 最优',
      value: '3.7 / 5',
      metricLabel: 'UI Judge 得分',
      subject: 'Minimal Catalog',
      detail:
        '平均 Tokens 7.9k；Catalog 仅包含 6 个组件，但 Agent 耗时不是本组最低。',
      tone: 'accent',
    },
  ],
  recommendation: {
    title: '建议起始配置',
    summary: '先用这组配置建立基线，再根据实际场景逐步增加组件。',
    combination: [
      {
        dimension: '模型',
        comparisonId: 'gpt-5-5',
        label: 'gpt-5.5-2026-04-24',
      },
      {
        dimension: 'Prompt',
        comparisonId: 'token-efficient',
        label: 'Token Efficient',
      },
      {
        dimension: 'Catalog',
        comparisonId: 'minimal-catalog',
        label: 'Minimal Catalog',
      },
    ],
  },
  comparisons: [
    {
      id: 'models',
      title: '实验 A · 模型对比',
      variable: '模型',
      fixedCondition:
        'System Prompt 为 Default A2UI Prompt，Catalog 为完整基础版本。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'deepseek-coder',
          name: 'deepseek-coder',
          tone: 'accent',
          descriptor: 'Agent 耗时最短',
          strength: '平均 Agent 耗时 13.9s，为模型组最低。',
          risk: '平均 Tokens 15.4k，高于 gpt-5.5；UI Judge 得分为 3.0/5。',
          metrics: {
            totalTokens: 15430,
            agentMs: 13922,
            renderMs: 9.3,
            fmpMs: 141,
            ttiMs: 1421,
            judge: 3,
            attempts: 1.7,
            success: 100,
          },
        },
        {
          id: 'gemini-3-pro',
          name: 'gemini-3-pro-preview-new',
          tone: 'warning',
          descriptor: 'UI Judge 持平，Tokens 与耗时最高',
          strength: 'UI Judge 得分平均 3.0/5，与模型组最高分持平。',
          risk: '平均 Tokens 22.9k、Agent 耗时 61.1s，平均生成 2.0 次。',
          metrics: {
            totalTokens: 22939,
            agentMs: 61103,
            renderMs: 9,
            fmpMs: 128,
            ttiMs: 1419,
            judge: 3,
            attempts: 2,
            success: 100,
          },
        },
        {
          id: 'gpt-5-5',
          name: 'gpt-5.5-2026-04-24',
          tone: 'positive',
          descriptor: 'Tokens 最少，UI Judge 并列最高',
          strength:
            '平均 Tokens 9.3k、UI Judge 得分 3.0/5；3 个场景均一次生成完成。',
          risk:
            '平均 Agent 耗时 37.8s；如果链路优先追求低延迟，deepseek-coder 更快。',
          metrics: {
            totalTokens: 9343,
            agentMs: 37767,
            renderMs: 10,
            fmpMs: 128,
            ttiMs: 1421,
            judge: 3,
            attempts: 1,
            success: 100,
          },
        },
      ],
    },
    {
      id: 'prompts',
      title: '实验 B · System Prompt 对比',
      variable: 'System Prompt',
      fixedCondition: '模型为 gpt-5.5-2026-04-24，Catalog 为完整基础版本。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'baseline',
          name: 'Baseline',
          tone: 'neutral',
          descriptor: 'Default A2UI Prompt',
          strength: 'UI Judge 得分平均 3.0/5，可作为默认对照组。',
          risk:
            '平均 Tokens 12.6k、Agent 耗时 41.3s；平均生成 1.3 次，部分运行触发 Repair。',
          metrics: {
            totalTokens: 12568,
            agentMs: 41310,
            renderMs: 10,
            fmpMs: 130,
            ttiMs: 1421,
            judge: 3,
            attempts: 1.3,
            success: 100,
          },
        },
        {
          id: 'token-efficient',
          name: 'Token Efficient',
          tone: 'positive',
          descriptor: '本轮综合表现最佳',
          strength:
            'UI Judge 得分平均 4.0/5，同时将 Tokens 降至 8.3k、Agent 耗时降至 24.4s。',
          risk:
            '输出风格更克制；如果业务需要更丰富的视觉表现，应逐项恢复视觉约束并重新验证。',
          metrics: {
            totalTokens: 8346,
            agentMs: 24430,
            renderMs: 10,
            fmpMs: 127,
            ttiMs: 1419,
            judge: 4,
            attempts: 1,
            success: 100,
          },
        },
        {
          id: 'visual-polish',
          name: 'Visual Polish',
          tone: 'warning',
          descriptor: '增加视觉要求后，UI Judge 得分下降',
          strength: '平均 Tokens 9.7k，3 个场景均一次生成完成。',
          risk: 'UI Judge 得分平均仅 1.7/5，Agent 耗时回升至 40.7s。',
          metrics: {
            totalTokens: 9659,
            agentMs: 40710,
            renderMs: 10,
            fmpMs: 129,
            ttiMs: 1418,
            judge: 1.7,
            attempts: 1,
            success: 100,
          },
        },
      ],
    },
    {
      id: 'catalogs',
      title: '实验 C · Catalog 对比',
      variable: 'Catalog',
      fixedCondition:
        '模型为 gpt-5.5-2026-04-24，System Prompt 为 Default A2UI Prompt。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'full-catalog',
          name: 'Full Catalog',
          tone: 'neutral',
          descriptor: '19 个组件 · 完整基础 Catalog',
          strength: '包含全部 19 个基础组件，3 个场景均一次生成完成。',
          risk:
            '平均 Tokens 9.2k、UI Judge 得分 3.0/5；Agent 耗时 35.3s，低于 Minimal Catalog。',
          metrics: {
            totalTokens: 9248,
            agentMs: 35319,
            renderMs: 11,
            fmpMs: 141,
            ttiMs: 1430,
            judge: 3,
            attempts: 1,
            success: 100,
          },
        },
        {
          id: 'core-catalog',
          name: 'Core Catalog',
          tone: 'warning',
          descriptor: '9 个组件 · 核心能力集',
          strength: 'UI Judge 得分平均 3.3/5，高于 Full Catalog。',
          risk: '平均 Tokens 13.5k、Agent 耗时 63.8s，平均生成 2.0 次。',
          metrics: {
            totalTokens: 13503,
            agentMs: 63766,
            renderMs: 10,
            fmpMs: 137,
            ttiMs: 1419,
            judge: 3.3,
            attempts: 2,
            success: 100,
          },
        },
        {
          id: 'minimal-catalog',
          name: 'Minimal Catalog',
          tone: 'positive',
          descriptor: '6 个组件 · Tokens 与 UI Judge 最优',
          strength:
            '平均 Tokens 7.9k，为本组最低；UI Judge 得分 3.7/5，为本组最高。',
          risk:
            'Agent 耗时平均 43.7s，高于 Full Catalog；仅覆盖 6 个组件，复杂场景需另行验证。',
          metrics: {
            totalTokens: 7907,
            agentMs: 43734,
            renderMs: 12,
            fmpMs: 136,
            ttiMs: 1421,
            judge: 3.7,
            attempts: 1.3,
            success: 100,
          },
        },
      ],
    },
  ],
  scenarios: [
    {
      id: 'weather-refresh-card',
      name: '天气刷新卡',
      businessMode: '信息查询',
      complexity: '低',
      interaction: '读取 + 刷新',
      prompt: '杭州天气卡：实况 24°C、湿度、风力、短预报，含 Refresh 操作。',
      purpose: '检验模型能否在轻量信息卡中控制组件数量，避免过度设计。',
    },
    {
      id: 'product-purchase-card',
      name: '商品购买卡',
      businessMode: '电商转化',
      complexity: '中',
      interaction: '选择 + 转化',
      prompt:
        'AeroPulse Runner 商品购买卡：图片、价格、评分、尺码、配送与 Buy Now。',
      purpose: '检验购买操作、价格与规格信息是否形成清晰的优先级。',
    },
    {
      id: 'kyoto-trip-planner',
      name: '京都行程规划',
      businessMode: '长内容浏览',
      complexity: '高',
      interaction: '浏览 + 保存',
      prompt: '48 小时京都行程：两天分段、时间节点、预算汇总与 Save Plan。',
      purpose: '检验长内容流和多层嵌套中的 Tokens 开销与结构正确性。',
    },
  ],
  methodology: {
    title: '实验方法与指标口径',
    sequence: ['先选模型', '再调 Prompt', '再压 Catalog'],
    items: [
      {
        id: 'generation',
        title: 'A2UI 生成',
        detail:
          '各实验使用对应的 A2UI System Prompt，并统一经过项目 Validator。验证失败时按 Runner 配置触发 Repair；生成次数记录实际调用次数。',
      },
      {
        id: 'rendering',
        title: 'A2UI 渲染',
        detail:
          '所有结果都在同一 Lynx4Web Playground Preview Runtime 中渲染，并按统一口径采集指标。',
      },
      {
        id: 'metrics',
        title: '指标定义',
        detail:
          'Agent 耗时指模型调用的实际耗时（wall time），包含 Repair；Render、FMP 与 TTI 均由 Preview Runtime 采集。FCP 已采集，但不作为本报告主指标。',
      },
      {
        id: 'judge',
        title: 'UI Judge 评分',
        detail:
          'UI Judge 按 visual-correctness 维度给出 0–5 分；评审模型为 gpt-5.5-2026-04-24。',
      },
    ],
  },
  limitations: [
    'Tokens 取自模型服务方返回的 usage。若触发 Repair，则统计首次生成和所有 Repair 的 Tokens 总和；生成次数单独记录。',
    'Render、FMP 与 TTI 仅反映本地 Lynx4Web Preview，不能代表真实移动端性能。',
    'UI Judge 由模型自动评分，只适合横向比较与基础合理性检查，不能替代人工 UI 评审。',
  ],
} as const satisfies PhaseOneBench;

type PhaseOneHighlightId = typeof PHASE_ONE_BENCH.highlights[number]['id'];
type PhaseOneMethodItemId =
  typeof PHASE_ONE_BENCH.methodology.items[number]['id'];
type PhaseOneScenarioId = typeof PHASE_ONE_BENCH.scenarios[number]['id'];

interface ComparisonCopy {
  fixedCondition: string;
  rows: Record<
    string,
    {
      descriptor: string;
      risk: string;
      strength: string;
    }
  >;
  title: string;
  variable: string;
}

const ENGLISH_HIGHLIGHTS = {
  'lowest-model-cost': {
    title: 'Model: lowest average token usage',
    metricLabel: 'Average tokens',
    detail:
      'Used the fewest average tokens in the model comparison and tied for the highest UI Judge score.',
  },
  'fastest-model': {
    title: 'Model: lowest agent latency',
    metricLabel: 'Average agent latency',
    detail:
      'Recorded the lowest average agent latency in the model comparison, but used more tokens than gpt-5.5.',
  },
  'best-prompt': {
    title: 'System Prompt: best overall',
    metricLabel: 'UI Judge score',
    detail:
      'Averaged 8.3k tokens and 24.4s of agent latency, outperforming the baseline on all three primary metrics.',
  },
  'best-catalog': {
    title: 'Catalog: best token usage and UI Judge score',
    metricLabel: 'UI Judge score',
    detail:
      'Averaged 7.9k tokens with a six-component Catalog, although agent latency was not the lowest in the group.',
  },
} as const satisfies Record<
  PhaseOneHighlightId,
  {
    detail: string;
    metricLabel: string;
    title: string;
  }
>;

const ENGLISH_COMPARISONS: Record<
  BenchComparison['id'],
  ComparisonCopy
> = {
  models: {
    title: 'Experiment A · Model comparison',
    variable: 'Model',
    fixedCondition:
      'Default A2UI Prompt as the System Prompt and the full base Catalog.',
    rows: {
      'deepseek-coder': {
        descriptor: 'Lowest agent latency',
        strength:
          'Average agent latency was 13.9s, the lowest in the model group.',
        risk:
          'Average token usage was 15.4k, higher than gpt-5.5; the UI Judge score was 3.0/5.',
      },
      'gemini-3-pro': {
        descriptor: 'Tied UI Judge score, highest token usage and latency',
        strength:
          'Averaged 3.0/5 on UI Judge, tied for the highest score in the model group.',
        risk:
          'Averaged 22.9k tokens, 61.1s of agent latency, and 2.0 generation attempts.',
      },
      'gpt-5-5': {
        descriptor: 'Lowest token usage, tied for highest UI Judge score',
        strength:
          'Averaged 9.3k tokens and 3.0/5 on UI Judge; all three scenarios completed in one attempt.',
        risk:
          'Average agent latency was 37.8s. When low latency is the priority, deepseek-coder is faster.',
      },
    },
  },
  prompts: {
    title: 'Experiment B · System Prompt comparison',
    variable: 'System Prompt',
    fixedCondition:
      'gpt-5.5-2026-04-24 as the model and the full base Catalog.',
    rows: {
      baseline: {
        descriptor: 'Default A2UI Prompt',
        strength:
          'Averaged 3.0/5 on UI Judge and provides a useful default baseline.',
        risk:
          'Averaged 12.6k tokens, 41.3s of agent latency, and 1.3 attempts; some runs triggered Repair.',
      },
      'token-efficient': {
        descriptor: 'Best overall result in this round',
        strength:
          'Averaged 4.0/5 on UI Judge while reducing token usage to 8.3k and agent latency to 24.4s.',
        risk:
          'The output is more restrained. For richer visual expression, restore visual constraints one at a time and revalidate.',
      },
      'visual-polish': {
        descriptor: 'Lower UI Judge score after adding visual requirements',
        strength:
          'Averaged 9.7k tokens, and all three scenarios completed in one attempt.',
        risk:
          'Averaged only 1.7/5 on UI Judge while agent latency rose to 40.7s.',
      },
    },
  },
  catalogs: {
    title: 'Experiment C · Catalog comparison',
    variable: 'Catalog',
    fixedCondition:
      'gpt-5.5-2026-04-24 as the model and Default A2UI Prompt as the System Prompt.',
    rows: {
      'full-catalog': {
        descriptor: '19 components · full base Catalog',
        strength:
          'Includes all 19 base components, and all three scenarios completed in one attempt.',
        risk:
          'Averaged 9.2k tokens and 3.0/5 on UI Judge; agent latency was 35.3s, lower than Minimal Catalog.',
      },
      'core-catalog': {
        descriptor: '9 components · core capability set',
        strength: 'Averaged 3.3/5 on UI Judge, higher than Full Catalog.',
        risk:
          'Averaged 13.5k tokens, 63.8s of agent latency, and 2.0 generation attempts.',
      },
      'minimal-catalog': {
        descriptor: '6 components · best token usage and UI Judge score',
        strength:
          'Averaged 7.9k tokens, the lowest in the group, and 3.7/5 on UI Judge, the highest in the group.',
        risk:
          'Average agent latency was 43.7s, higher than Full Catalog. Its six components require separate validation for complex scenarios.',
      },
    },
  },
};

const ENGLISH_SCENARIOS = {
  'weather-refresh-card': {
    name: 'Weather refresh card',
    businessMode: 'Information lookup',
    complexity: 'Low',
    interaction: 'Read + refresh',
    purpose:
      'Tests whether the model can control component count in a lightweight information card and avoid overdesign.',
  },
  'product-purchase-card': {
    name: 'Product purchase card',
    businessMode: 'E-commerce conversion',
    complexity: 'Medium',
    interaction: 'Select + convert',
    purpose:
      'Tests whether purchase actions, pricing, and variant details form a clear hierarchy.',
  },
  'kyoto-trip-planner': {
    name: 'Kyoto trip planner',
    businessMode: 'Long-form browsing',
    complexity: 'High',
    interaction: 'Browse + save',
    purpose:
      'Tests token overhead and structural correctness in long-form flows with deep nesting.',
  },
} as const satisfies Record<
  PhaseOneScenarioId,
  {
    businessMode: string;
    complexity: BenchScenario['complexity'];
    interaction: string;
    name: string;
    purpose: string;
  }
>;

const ENGLISH_METHOD_ITEMS = {
  generation: {
    title: 'A2UI generation',
    detail:
      'Each experiment uses its corresponding A2UI System Prompt and the same project Validator. When validation fails, Repair follows the Runner configuration; attempt count records the actual number of calls.',
  },
  rendering: {
    title: 'A2UI rendering',
    detail:
      'Every result is rendered in the same Lynx4Web Playground Preview Runtime, with metrics collected under one consistent definition.',
  },
  metrics: {
    title: 'Metric definitions',
    detail:
      'Agent latency is model wall time including Repair. Render, FMP, and TTI are collected by the Preview Runtime. FCP is collected but is not a primary metric in this report.',
  },
  judge: {
    title: 'UI Judge scoring',
    detail:
      'UI Judge assigns a 0–5 visual-correctness score. The judge model is gpt-5.5-2026-04-24.',
  },
} as const satisfies Record<
  PhaseOneMethodItemId,
  {
    detail: string;
    title: string;
  }
>;

export const PHASE_ONE_BENCH_EN = {
  ...PHASE_ONE_BENCH,
  title: 'How should you choose a model, System Prompt, and Catalog?',
  description:
    'The benchmark covers three mobile A2UI scenarios. Each experiment changes one variable at a time and uses the same metrics for generation cost, latency, stability, and visual correctness.',
  conclusion:
    'In the model group, gpt-5.5 used the fewest average tokens. In the Prompt group, Token Efficient delivered the best balance. In the Catalog group, Minimal Catalog led in token usage and UI Judge score, but not in agent latency.',
  metricDefinitions: PHASE_ONE_BENCH.metricDefinitions.map((definition) => ({
    ...definition,
    label: {
      totalTokens: 'Tokens',
      agentMs: 'Agent latency',
      renderMs: 'Render',
      fmpMs: 'FMP',
      ttiMs: 'TTI',
      judge: 'UI Judge',
      attempts: 'Generation attempts',
      success: 'Success',
    }[definition.key],
  })),
  highlights: PHASE_ONE_BENCH.highlights.map((highlight) => ({
    ...highlight,
    ...ENGLISH_HIGHLIGHTS[highlight.id],
  })),
  recommendation: {
    title: 'Recommended starting configuration',
    summary:
      'Use this configuration as a baseline, then add components gradually for each real-world scenario.',
    combination: [
      {
        ...PHASE_ONE_BENCH.recommendation.combination[0],
        dimension: 'Model',
      },
      PHASE_ONE_BENCH.recommendation.combination[1],
      PHASE_ONE_BENCH.recommendation.combination[2],
    ],
  },
  comparisons: PHASE_ONE_BENCH.comparisons.map((comparison) => {
    const copy = ENGLISH_COMPARISONS[comparison.id];
    return {
      ...comparison,
      title: copy.title,
      variable: copy.variable,
      fixedCondition: copy.fixedCondition,
      rows: comparison.rows.map((row) => ({
        ...row,
        ...copy.rows[row.id],
      })),
    };
  }),
  scenarios: PHASE_ONE_BENCH.scenarios.map((scenario) => ({
    ...scenario,
    ...ENGLISH_SCENARIOS[scenario.id],
  })),
  methodology: {
    title: 'Methodology and metric definitions',
    sequence: ['Choose a model', 'Tune the Prompt', 'Reduce the Catalog'],
    items: PHASE_ONE_BENCH.methodology.items.map((item) => ({
      ...item,
      ...ENGLISH_METHOD_ITEMS[item.id],
    })),
  },
  limitations: [
    'Token counts come from model-provider usage. If Repair is triggered, the total includes the initial generation and every Repair; attempt count is reported separately.',
    'Render, FMP, and TTI reflect only the local Lynx4Web Preview and do not represent real mobile performance.',
    'UI Judge is model-based automation intended for relative comparison and basic plausibility checks; it does not replace human UI review.',
  ],
} satisfies PhaseOneBench;

export function getPhaseOneBench(
  locale: BenchLocale = 'zh-CN',
): PhaseOneBench {
  return locale === 'en-US' ? PHASE_ONE_BENCH_EN : PHASE_ONE_BENCH;
}
