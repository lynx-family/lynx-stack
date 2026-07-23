// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
  complexity: '低' | '中' | '高';
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
    dimension: '模型' | 'Prompt' | 'Catalog';
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
  eyebrow: 'Lynx A2UI Bench · Phase 1',
  title: '一期 Bench：从模型、Prompt 到 Catalog',
  description:
    '在三类移动端 Generative UI 场景中，依次比较模型、System Prompt 与 Catalog，观察生成成本、延迟、稳定性和视觉正确性。',
  conclusion:
    'Token Efficient 是当前最优 System Prompt，Minimal Catalog 是当前最优 Catalog 取舍；两者都让模型更聚焦，主要收益发生在 Agent 生成阶段。',
  scope: {
    runs: 30,
    scenarios: 3,
    models: 4,
    prompts: 3,
    catalogs: 3,
  },
  metricDefinitions: [
    {
      key: 'totalTokens',
      label: 'Total tokens',
      unit: 'tokens',
      direction: 'lower',
      precision: 0,
    },
    {
      key: 'agentMs',
      label: 'Agent latency',
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
      label: 'UI judge',
      unit: 'score',
      direction: 'higher',
      precision: 1,
    },
    {
      key: 'attempts',
      label: 'Attempts',
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
      title: '模型成本最低',
      value: '9.3k',
      metricLabel: 'avg tokens',
      subject: 'gpt-5.5-2026-04-24',
      detail: '固定 Prompt 下平均 Total tokens 最低。',
      tone: 'neutral',
    },
    {
      id: 'fastest-model',
      title: '模型生成最快',
      value: '13.9s',
      metricLabel: 'avg agent',
      subject: 'deepseek-coder',
      detail: '模型组中 Agent latency 最低。',
      tone: 'neutral',
    },
    {
      id: 'best-prompt',
      title: 'System Prompt 最优',
      value: '4.0',
      metricLabel: 'UI judge',
      subject: 'Token Efficient',
      detail: '平均 8.3k tokens、24.4s Agent latency。',
      tone: 'positive',
    },
    {
      id: 'best-catalog',
      title: 'Catalog 最优',
      value: '3.7',
      metricLabel: 'UI judge',
      subject: 'Minimal Catalog',
      detail: '平均 7.9k tokens，仅暴露 6 个组件。',
      tone: 'accent',
    },
  ],
  recommendation: {
    title: '推荐组合',
    summary:
      '先用 GPT + Token Efficient + 小 Catalog 跑基线，再按业务表达需求逐步放回组件。',
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
      title: '实验 A · LLM 对比',
      variable: 'Model',
      fixedCondition: '固定 Default A2UI Prompt 与完整基础 Catalog。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'deepseek-coder',
          name: 'deepseek-coder',
          tone: 'accent',
          descriptor: '低延迟优先',
          strength: '平均 Agent latency 13.9s，为模型组最低。',
          risk: 'Token 成本高于 GPT，复杂长内容场景仍有质量波动。',
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
          id: 'doubao-seed-code',
          name: 'doubao-seed-code',
          tone: 'warning',
          descriptor: '成本与质量均不占优',
          strength: '三类场景均完成，平均 Total tokens 为 16.4k。',
          risk: '平均 UI judge 2.3/5，为模型组最低；Agent latency 42.8s。',
          metrics: {
            totalTokens: 16435,
            agentMs: 42790,
            renderMs: 9,
            fmpMs: 128,
            ttiMs: 1427,
            judge: 2.3,
            attempts: 1.7,
            success: 100,
          },
        },
        {
          id: 'gemini-3-pro',
          name: 'gemini-3-pro-preview-new',
          tone: 'warning',
          descriptor: '质量持平，但成本与延迟最高',
          strength: '平均 UI judge 3.0/5，与模型组最佳分数持平。',
          risk:
            '平均 22.9k tokens、61.1s Agent latency，且需 2.0 次 Attempts。',
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
          descriptor: '成本最低、质量均衡',
          strength: '平均 9.3k tokens、UI judge 3.0/5，且一次生成成功。',
          risk: '平均 Agent latency 37.8s，不适合极致延迟链路。',
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
      title: '实验 B · Prompt 对比',
      variable: 'System Prompt',
      fixedCondition: '固定模型 gpt-5.5-2026-04-24 与完整基础 Catalog。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'baseline',
          name: 'Baseline',
          tone: 'neutral',
          descriptor: 'Default A2UI Prompt',
          strength: '平均 UI judge 3.0/5，可作为默认对照组。',
          risk: '平均 12.6k tokens、41.3s Agent latency，且有 Repair。',
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
          descriptor: '当前最优 System Prompt',
          strength: '平均 UI judge 4.0/5，同时降至 8.3k tokens、24.4s。',
          risk: '表达更克制；需要更丰富视觉时，应按业务需求逐步放回要求。',
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
          descriptor: '视觉要求更强，但收益为负',
          strength: '平均 9.7k tokens，三类场景均一次生成完成。',
          risk: '平均 UI judge 仅 1.7/5，Agent latency 回升至 40.7s。',
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
      fixedCondition: '固定模型 gpt-5.5-2026-04-24 与 Default A2UI Prompt。',
      primaryMetrics: ['totalTokens', 'agentMs', 'judge', 'attempts'],
      rows: [
        {
          id: 'full-catalog',
          name: 'Full Catalog',
          tone: 'neutral',
          descriptor: '19 个组件 · 完整基础 Catalog',
          strength: '表达能力最完整，平均一次生成完成。',
          risk: '平均 9.2k tokens、UI judge 3.0/5，综合取舍不及 Minimal。',
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
          strength: '平均 UI judge 3.3/5，质量略高于 Full Catalog。',
          risk:
            '平均 13.5k tokens、63.8s Agent latency，且需 2.0 次 Attempts。',
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
          descriptor: '6 个组件 · 当前最优取舍',
          strength: '平均 7.9k tokens、UI judge 3.7/5，成本最低且质量最高。',
          risk: '表达力上限较低；复杂业务应按需逐步增加组件。',
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
      name: 'Weather Refresh Card',
      businessMode: '信息查询',
      complexity: '低',
      interaction: '读取 + 刷新',
      prompt: '杭州天气卡：实况 24°C、湿度、风力、短预报，含 Refresh 操作。',
      purpose: '检验模型在“少即是多”的小卡片上是否过度堆砌组件。',
    },
    {
      id: 'product-purchase-card',
      name: 'Product Purchase Card',
      businessMode: '电商转化',
      complexity: '中',
      interaction: '选择 + 转化',
      prompt:
        'AeroPulse Runner 商品购买卡：图片、价格、评分、尺码、配送与 Buy Now。',
      purpose: '检验模型能否让关键 Action 保持清晰、显眼的视觉层级。',
    },
    {
      id: 'kyoto-trip-planner',
      name: 'Kyoto Trip Planner',
      businessMode: '长内容浏览',
      complexity: '高',
      interaction: '浏览 + 保存',
      prompt: '48 小时京都行程：两天分段、时间节点、预算汇总与 Save Plan。',
      purpose: '检验长 Stream 与多层嵌套下的 Token 膨胀和结构正确性。',
    },
  ],
  methodology: {
    title: '运行口径',
    sequence: ['先选模型', '再调 Prompt', '再压 Catalog'],
    items: [
      {
        id: 'generation',
        title: 'A2UI generation',
        detail:
          '统一使用 A2UI System Prompt 与项目 Validator；失败按 Runner 配置进入 Repair，Attempts 记录实际生成次数。',
      },
      {
        id: 'rendering',
        title: 'A2UI rendering',
        detail:
          '在同一 Lynx4Web Playground Preview Runtime 中注入生成消息，并采集同口径渲染指标。',
      },
      {
        id: 'metrics',
        title: 'Metrics',
        detail:
          'Agent 是模型调用 Wall time，包含 Repair；Render、FMP、TTI 来自 Preview Runtime。FCP 有采集，但不作为本页主指标。',
      },
      {
        id: 'judge',
        title: 'UI judge',
        detail:
          '使用 visual-correctness 维度评分，范围 0–5；Judge 模型为 gpt-5.5-2026-04-24。',
      },
    ],
  },
  limitations: [
    'Token usage 采用 Provider 返回值；发生 Repair 时，为 Initial 与所有 Repair Attempts 的用量合计，并单独保留 Attempts。',
    'Render、FMP、TTI 来自 Lynx4Web 本地 Preview，不能等同于真实移动端渲染性能。',
    'UI judge 是模型评审，适合横向 Sanity check，不应单独作为最终 UI 质量结论。',
  ],
} as const satisfies PhaseOneBench;
