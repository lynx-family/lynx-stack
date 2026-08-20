// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import './BenchPage.css';

import { Button } from '../components/Button.js';
import {
  Copy,
  History,
  Maximize2,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  Zap,
} from '../components/Icon.js';
import { PageHeader } from '../components/PageHeader.js';
import {
  GENUI_SERVER_URL,
  buildGenuiServerUrl,
} from '../config/genuiServer.js';
import { copyToClipboard } from '../utils/clipboard.js';
import type { BenchLocale } from './bench/benchLocale.js';

type BenchRole = 'control' | 'experiment';
type BenchProtocol = 'a2ui' | 'openui';
type BenchProfile = 'native' | 'matched-core';
type BenchVariable =
  | 'protocol'
  | 'model'
  | 'prompt'
  | 'catalog'
  | 'custom';
type BenchStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled';
type BenchScreenshotState = 'captured' | 'failed' | 'missing';
type BenchGroupSystemName =
  | 'a2ui'
  | 'baseline'
  | 'core-catalog'
  | 'default-prompt'
  | 'new-baseline'
  | 'new-comparison'
  | 'openui'
  | 'token-efficient';
type BenchScenarioSystemText =
  | 'custom'
  | 'custom-prompt'
  | 'custom-scenario'
  | 'primary-action';
type BenchRunMessage =
  | { code: 'bench-cancelled' }
  | { code: 'bench-complete'; failedRuns?: number }
  | { code: 'bench-failed' }
  | { code: 'bench-request-failed'; status: number }
  | { code: 'cancellation-failed'; jobId: string }
  | { code: 'complete-report-loaded' }
  | { code: 'creating-job' }
  | { code: 'defaults-confirmation-required' }
  | { code: 'history-report-loaded'; failedRuns?: number }
  | { code: 'job-queued'; jobId: string }
  | { code: 'loading-report'; jobId: string }
  | { code: 'preset-loaded' }
  | { code: 'raw'; text: string }
  | { code: 'ready' }
  | { code: 'reconnecting' }
  | { code: 'report-load-failed'; status: number }
  | { code: 'report-loaded'; failedRuns?: number }
  | {
    code: 'run-progress';
    group?: Pick<BenchGroup, 'name' | 'systemName'>;
    phase: string;
    repeatIndex: number;
    scenario?: Pick<BenchScenario, 'name' | 'systemName'>;
  }
  | { code: 'run-config-required' }
  | { code: 'running' }
  | { code: 'setup-restored-loading-report' }
  | { code: 'setup-restored-report-unavailable' }
  | { code: 'stopping-previous-job' }
  | { code: 'stream-disconnected' };

function benchText(
  locale: BenchLocale,
  chinese: string,
  english: string,
): string {
  return locale === 'en-US' ? english : chinese;
}

export function getBenchRunMessageText(
  message: BenchRunMessage,
  locale: BenchLocale,
): string {
  switch (message.code) {
    case 'bench-cancelled':
      return benchText(locale, 'Bench 任务已取消', 'Bench job cancelled');
    case 'bench-complete':
      return message.failedRuns
        ? benchText(
          locale,
          `Bench 完成 · ${message.failedRuns} 个失败 Run`,
          `Bench complete · ${message.failedRuns} failed runs`,
        )
        : benchText(locale, 'Bench 完成', 'Bench complete');
    case 'bench-failed':
      return benchText(locale, 'Bench 任务失败', 'Bench job failed');
    case 'bench-request-failed':
      return benchText(
        locale,
        `Bench 请求失败：${message.status}`,
        `Bench request failed: ${message.status}`,
      );
    case 'cancellation-failed':
      return benchText(
        locale,
        `Job ${message.jobId} 尚未取消，请再次重置重试`,
        `Job ${message.jobId} was not cancelled. Reset again to retry.`,
      );
    case 'complete-report-loaded':
      return benchText(
        locale,
        '完整 Report 已载入',
        'Complete report loaded',
      );
    case 'creating-job':
      return benchText(locale, '正在创建 Bench 任务…', 'Creating Bench job…');
    case 'defaults-confirmation-required':
      return benchText(
        locale,
        '请确认使用服务端默认配置',
        'Confirm that you want to use the server defaults',
      );
    case 'history-report-loaded':
      return message.failedRuns
        ? benchText(
          locale,
          `历史 Report 已载入 · ${message.failedRuns} 个失败 Run`,
          `Saved report loaded · ${message.failedRuns} failed runs`,
        )
        : benchText(locale, '历史 Report 已载入', 'Saved report loaded');
    case 'job-queued':
      return benchText(
        locale,
        `Job ${message.jobId} 已进入队列`,
        `Job ${message.jobId} queued`,
      );
    case 'loading-report':
      return benchText(
        locale,
        `正在载入 Report ${message.jobId}…`,
        `Loading report ${message.jobId}…`,
      );
    case 'preset-loaded':
      return benchText(locale, '已载入预设', 'Preset loaded');
    case 'raw':
      return message.text;
    case 'ready':
      return benchText(locale, '准备就绪', 'Ready');
    case 'reconnecting':
      return benchText(
        locale,
        '正在重连 Bench 数据流…',
        'Reconnecting to the Bench event stream…',
      );
    case 'report-load-failed':
      return benchText(
        locale,
        `Report 载入失败：${message.status}`,
        `Failed to load report: ${message.status}`,
      );
    case 'report-loaded':
      return message.failedRuns
        ? benchText(
          locale,
          `Report 已载入 · ${message.failedRuns} 个失败 Run`,
          `Report loaded · ${message.failedRuns} failed runs`,
        )
        : benchText(locale, 'Report 已载入', 'Report loaded');
    case 'run-config-required':
      return benchText(
        locale,
        '请先完成运行配置',
        'Complete the run setup first',
      );
    case 'run-progress': {
      const groupName = message.group
        ? getBenchGroupDisplayName(message.group, locale)
        : benchText(locale, '对比组', 'Comparison group');
      const scenarioName = message.scenario
        ? getBenchScenarioDisplayName(message.scenario, locale)
        : benchText(locale, '场景', 'Scenario');
      return `${groupName} · ${scenarioName} · #${message.repeatIndex} · ${message.phase}`;
    }
    case 'running':
      return benchText(locale, 'Bench 运行中…', 'Bench running…');
    case 'setup-restored-loading-report':
      return benchText(
        locale,
        '配置已恢复，正在载入完整 Report…',
        'Setup restored. Loading the complete report…',
      );
    case 'setup-restored-report-unavailable':
      return benchText(
        locale,
        '配置已恢复 · 完整 Report 暂不可用',
        'Setup restored · Complete report unavailable',
      );
    case 'stopping-previous-job':
      return benchText(
        locale,
        '正在停止上一项 Bench 任务…',
        'Stopping the previous Bench job…',
      );
    case 'stream-disconnected':
      return benchText(
        locale,
        'Bench 数据流已断开',
        'Bench event stream disconnected',
      );
  }
}

interface BenchEnv {
  apiKey: string;
  baseURL: string;
  model: string;
}

interface BenchGroup {
  id: string;
  role: BenchRole;
  protocol: BenchProtocol;
  profile: BenchProfile;
  name: string;
  variable: BenchVariable;
  model: string;
  catalog: string;
  extraInstruction: string;
  enabled: boolean;
  systemName?: BenchGroupSystemName;
}

interface BenchScenario {
  id: string;
  name: string;
  prompt: string;
  type: string;
  complexity: number;
  action: string;
  systemAction?: BenchScenarioSystemText;
  systemName?: BenchScenarioSystemText;
  systemPrompt?: BenchScenarioSystemText;
  systemType?: BenchScenarioSystemText;
}

interface BenchSettings {
  repeats: number;
  parallelism: number;
  repairEnabled: boolean;
  judgeEnabled: boolean;
  collectLiveRenderMetrics: boolean;
}

interface BenchResult {
  id: string;
  groupId: string;
  groupName: string;
  role: BenchRole;
  protocol?: BenchProtocol;
  profile?: BenchProfile;
  scenarioId: string;
  scenarioName: string;
  repeatIndex?: number;
  status?: 'complete' | 'failed';
  ok?: boolean;
  model?: string;
  catalog?: string;
  tokens: number;
  agentMs: number;
  fmpMs: number;
  ttiMs: number;
  renderMs: number;
  attempts: number;
  judgeDimensions?: BenchJudgeDimensionResult[];
  judgeGeqiScore?: number;
  judgeScore: number;
  judgeStatus?: 'complete' | 'failed' | 'skipped';
  judgeWarnings?: string[];
  messageCount?: number;
  outputChars?: number;
  errors?: string[];
  error?: string;
  screenshotDataUrl?: string;
}

interface BenchJudgeDimensionResult {
  dimension: string;
  dimensionLabel: string;
  error?: string;
  reason?: string;
  score: number;
  summary?: string;
  weight: number;
}

interface BenchGroupSummary {
  groupId: string;
  groupName: string;
  role: BenchRole;
  protocol?: BenchProtocol;
  profile?: BenchProfile;
  runCount?: number;
  failedRuns?: number;
  successRate?: number;
  avgTokens: number;
  avgAgentMs: number;
  avgFmpMs: number;
  avgTtiMs: number;
  avgRenderMs: number;
  avgJudgeScore: number;
  avgJudgeGeqiScore?: number;
  judgeRunCount?: number;
  avgAttempts: number;
}

interface BenchReport {
  id: string;
  jobId?: string;
  createdAt: string;
  completedAt?: string;
  status?: BenchStatus;
  settings: BenchSettings;
  env: {
    apiKeyConfigured: boolean;
    model: string;
    clientOverrideAccepted?: boolean;
  };
  capabilities?: {
    agent: 'enabled';
    renderMetrics: 'disabled' | 'enabled';
    judge: 'disabled' | 'enabled';
  };
  warnings?: string[];
  groups: BenchGroup[];
  scenarios: BenchScenario[];
  results: BenchResult[];
  summaries: BenchGroupSummary[];
  summary?: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    avgTokens: number;
    avgAgentMs: number;
    avgAttempts: number;
  };
}

interface BenchHealth {
  ok: boolean;
  provider?: string;
  hasKey?: boolean;
  modelName?: string;
  imageGenerationReady?: boolean;
  error?: string;
}

type BenchHealthError =
  | { kind: 'raw'; message: string }
  | { kind: 'status'; status: number };

interface BenchJobCreated {
  ok?: boolean;
  jobId?: string;
  eventsUrl?: string;
  reportUrl?: string;
  error?: string;
  warnings?: string[];
}

interface BenchJobSnapshot {
  ok?: boolean;
  status?: BenchStatus;
  progress?: {
    completedRuns?: number;
    totalRuns?: number;
    current?: {
      groupId: string;
      scenarioId: string;
      repeatIndex: number;
      phase: string;
    };
  };
  error?: string;
  warnings?: string[];
}

interface BenchHistoryConfig {
  env: {
    apiKeyConfigured: boolean;
    model: string;
  };
  settings: BenchSettings;
  groups: BenchGroup[];
  scenarios: BenchScenario[];
}

interface BenchHistoryEntry {
  id: string;
  title: string;
  savedAt: string;
  report: BenchReport;
  config: BenchHistoryConfig;
}

interface BenchScreenshotSlot {
  key: string;
  repeatIndex: number;
  result: BenchResult | null;
  state: BenchScreenshotState;
}

interface BenchScreenshotMatrixCell {
  key: string;
  group: BenchGroup;
  scenario: BenchScenario;
  slots: BenchScreenshotSlot[];
}

interface BenchScreenshotMatrixRow {
  key: string;
  group: BenchGroup;
  cells: BenchScreenshotMatrixCell[];
}

interface BenchScreenshotMatrix {
  rows: BenchScreenshotMatrixRow[];
  scenarios: BenchScenario[];
  repeatCount: number;
  total: number;
  captured: number;
  failed: number;
  missing: number;
}

type BenchReportSettingsPayload = Partial<BenchSettings> & {
  renderMetricsEnabled?: boolean;
};

function getBenchGroupSystemNameText(
  systemName: BenchGroupSystemName,
  locale: BenchLocale,
): string {
  switch (systemName) {
    case 'default-prompt':
      return benchText(locale, '默认 Prompt', 'Default Prompt');
    case 'token-efficient':
      return benchText(locale, 'Token 精简', 'Token Efficient');
    case 'new-baseline':
      return benchText(locale, '新基准组', 'New baseline');
    case 'new-comparison':
      return benchText(locale, '新对比组', 'New comparison');
    case 'a2ui':
      return 'A2UI';
    case 'baseline':
      return 'Baseline';
    case 'core-catalog':
      return 'Core Catalog';
    case 'openui':
      return 'OpenUI';
  }
}

export function getBenchGroupDisplayName(
  group: Pick<BenchGroup, 'name' | 'systemName'>,
  locale: BenchLocale,
): string {
  return group.systemName
    ? getBenchGroupSystemNameText(group.systemName, locale)
    : group.name;
}

function isBenchGroupSystemNameText(
  value: string,
  systemName: BenchGroupSystemName,
): boolean {
  return value === getBenchGroupSystemNameText(systemName, 'zh-CN')
    || value === getBenchGroupSystemNameText(systemName, 'en-US');
}

function inferBenchGroupSystemName(
  group: Pick<BenchGroup, 'id' | 'name' | 'systemName'>,
): BenchGroupSystemName | undefined {
  if (group.systemName) return group.systemName;
  const byId: Record<string, BenchGroupSystemName> = {
    'control-a2ui-matched': 'a2ui',
    'control-default': 'default-prompt',
    'control-empty': 'baseline',
    'experiment-core': 'core-catalog',
    'experiment-openui-matched': 'openui',
    'experiment-token': 'token-efficient',
  };
  const idMatch = byId[group.id];
  if (idMatch && isBenchGroupSystemNameText(group.name, idMatch)) {
    return idMatch;
  }
  return ([
    'new-baseline',
    'new-comparison',
  ] as const).find((systemName) =>
    isBenchGroupSystemNameText(group.name, systemName)
  );
}

function restoreBenchGroupSystemNames(groups: BenchGroup[]): BenchGroup[] {
  return groups.map((group) => ({
    ...group,
    systemName: inferBenchGroupSystemName(group),
  }));
}

function getBenchScenarioSystemText(
  systemText: BenchScenarioSystemText,
  locale: BenchLocale,
): string {
  switch (systemText) {
    case 'custom':
      return benchText(locale, '自定义', 'Custom');
    case 'custom-prompt':
      return benchText(
        locale,
        '描述需要生成和评测的 UI。',
        'Describe the UI to generate and evaluate.',
      );
    case 'custom-scenario':
      return benchText(locale, '自定义场景', 'Custom scenario');
    case 'primary-action':
      return benchText(locale, '主操作', 'Primary action');
  }
}

function getBenchScenarioFieldText(
  value: string,
  systemText: BenchScenarioSystemText | undefined,
  locale: BenchLocale,
): string {
  return systemText
    ? getBenchScenarioSystemText(systemText, locale)
    : value;
}

export function getBenchScenarioDisplayName(
  scenario: Pick<BenchScenario, 'name' | 'systemName'>,
  locale: BenchLocale,
): string {
  return getBenchScenarioFieldText(
    scenario.name,
    scenario.systemName,
    locale,
  );
}

function inferBenchScenarioSystemText(
  value: string,
  expected: BenchScenarioSystemText,
): BenchScenarioSystemText | undefined {
  return value === getBenchScenarioSystemText(expected, 'zh-CN')
      || value === getBenchScenarioSystemText(expected, 'en-US')
    ? expected
    : undefined;
}

function restoreBenchScenarioSystemTexts(
  scenarios: BenchScenario[],
): BenchScenario[] {
  return scenarios.map((scenario) => ({
    ...scenario,
    systemAction: scenario.systemAction
      ?? inferBenchScenarioSystemText(scenario.action, 'primary-action'),
    systemName: scenario.systemName
      ?? inferBenchScenarioSystemText(scenario.name, 'custom-scenario'),
    systemPrompt: scenario.systemPrompt
      ?? inferBenchScenarioSystemText(scenario.prompt, 'custom-prompt'),
    systemType: scenario.systemType
      ?? inferBenchScenarioSystemText(scenario.type, 'custom'),
  }));
}

const CATALOG_OPTIONS = [
  'Full Catalog',
  'Core Catalog',
  'Minimal Catalog',
] as const;

const DEFAULT_ENV: BenchEnv = {
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-5.5-2026-04-24',
};

const DEFAULT_SETTINGS: BenchSettings = {
  repeats: 3,
  parallelism: 2,
  repairEnabled: true,
  judgeEnabled: true,
  collectLiveRenderMetrics: true,
};

const REPORT_PANE_DEFAULT_WIDTH = 440;
const REPORT_PANE_MIN_WIDTH = 360;
const REPORT_PANE_MAX_WIDTH = 640;
const MAIN_PANE_MIN_WIDTH = 620;
const RESIZE_HANDLE_WIDTH = 10;
const REPORT_PANE_RESIZE_BREAKPOINT = 1240;
const REPORT_PANE_WIDTH_STORAGE_KEY = 'a2ui-bench-report-width';
const SCREENSHOT_DIALOG_DEFAULT_WIDTH = 1040;
const SCREENSHOT_DIALOG_MIN_WIDTH = 720;
const SCREENSHOT_DIALOG_MAX_WIDTH = 1440;
const SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY =
  'a2ui-bench-screenshot-dialog-width';
const EVENT_SOURCE_CLOSED_READY_STATE = 2;
const BENCH_HISTORY_STORAGE_KEY = 'a2ui-bench-history';
const BENCH_HISTORY_LIMIT = 20;
const LOCAL_A2UI_SERVER_PORT = '3060';

const DEFAULT_GROUPS: BenchGroup[] = [
  {
    id: 'control-default',
    role: 'control',
    protocol: 'a2ui',
    profile: 'native',
    name: '默认 Prompt',
    variable: 'prompt',
    model: 'gpt-5.5-2026-04-24',
    catalog: 'Full Catalog',
    extraInstruction: '',
    enabled: true,
    systemName: 'default-prompt',
  },
  {
    id: 'experiment-token',
    role: 'experiment',
    protocol: 'a2ui',
    profile: 'native',
    name: 'Token 精简',
    variable: 'prompt',
    model: 'gpt-5.5-2026-04-24',
    catalog: 'Full Catalog',
    extraInstruction:
      'Keep the A2UI message stream as short as possible while preserving all required content.',
    enabled: true,
    systemName: 'token-efficient',
  },
  {
    id: 'experiment-core',
    role: 'experiment',
    protocol: 'a2ui',
    profile: 'native',
    name: 'Core Catalog',
    variable: 'catalog',
    model: 'gpt-5.5-2026-04-24',
    catalog: 'Core Catalog',
    extraInstruction: '',
    enabled: true,
    systemName: 'core-catalog',
  },
];

const EMPTY_GROUPS: BenchGroup[] = [
  {
    id: 'control-empty',
    role: 'control',
    protocol: 'a2ui',
    profile: 'native',
    name: 'Baseline',
    variable: 'custom',
    model: DEFAULT_ENV.model,
    catalog: 'Full Catalog',
    extraInstruction: '',
    enabled: true,
    systemName: 'baseline',
  },
];

const PROTOCOL_PAIR_GROUPS: BenchGroup[] = [
  {
    id: 'control-a2ui-matched',
    role: 'control',
    protocol: 'a2ui',
    profile: 'matched-core',
    name: 'A2UI',
    variable: 'protocol',
    model: DEFAULT_ENV.model,
    catalog: 'Core Catalog',
    extraInstruction: '',
    enabled: true,
    systemName: 'a2ui',
  },
  {
    id: 'experiment-openui-matched',
    role: 'experiment',
    protocol: 'openui',
    profile: 'matched-core',
    name: 'OpenUI',
    variable: 'protocol',
    model: DEFAULT_ENV.model,
    catalog: 'Core Catalog',
    extraInstruction: '',
    enabled: true,
    systemName: 'openui',
  },
];

const COMBINED_GROUPS: BenchGroup[] = [
  ...DEFAULT_GROUPS,
  ...PROTOCOL_PAIR_GROUPS,
];

type BenchGroupPreset =
  | 'a2ui-variants'
  | 'protocol-pair'
  | 'combined'
  | 'blank';

function getBenchGroupPreset(preset: BenchGroupPreset): BenchGroup[] {
  switch (preset) {
    case 'a2ui-variants':
      return DEFAULT_GROUPS;
    case 'protocol-pair':
      return PROTOCOL_PAIR_GROUPS;
    case 'combined':
      return COMBINED_GROUPS;
    case 'blank':
      return EMPTY_GROUPS;
  }
}

const DEFAULT_SCENARIOS: BenchScenario[] = [
  {
    id: 'weather-refresh',
    name: 'Weather Refresh Card',
    prompt:
      'A Hangzhou weather UI with current weather, 24 C, humidity, wind, short forecast, and Refresh action.',
    type: 'Information',
    complexity: 0.86,
    action: 'Refresh',
  },
  {
    id: 'product-purchase',
    name: 'Product Purchase Card',
    prompt:
      'A product purchase UI for AeroPulse Runner with image, price, rating, size choices, delivery, and Buy Now action.',
    type: 'Commerce',
    complexity: 1.08,
    action: 'Buy Now',
  },
  {
    id: 'kyoto-trip',
    name: 'Kyoto Trip Planner',
    prompt:
      'A 48-hour Kyoto itinerary UI with two day sections, timed stops, budget summary, and Save Plan action.',
    type: 'Long content',
    complexity: 1.36,
    action: 'Save Plan',
  },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${
    Math.random().toString(36).slice(2, 8)
  }`;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampReportPaneWidth(
  value: number,
  containerWidth?: number,
): number {
  const maxByContainer = containerWidth
    ? containerWidth - MAIN_PANE_MIN_WIDTH - RESIZE_HANDLE_WIDTH
    : REPORT_PANE_MAX_WIDTH;
  const max = Math.min(
    REPORT_PANE_MAX_WIDTH,
    Math.max(REPORT_PANE_MIN_WIDTH, maxByContainer),
  );
  return clampNumber(value, REPORT_PANE_MIN_WIDTH, max);
}

function clampScreenshotDialogWidth(value: number): number {
  const viewportMax = typeof window === 'undefined'
    ? SCREENSHOT_DIALOG_MAX_WIDTH
    : Math.max(320, window.innerWidth - 48);
  const max = Math.max(
    Math.min(SCREENSHOT_DIALOG_MIN_WIDTH, viewportMax),
    Math.min(SCREENSHOT_DIALOG_MAX_WIDTH, viewportMax),
  );
  const min = Math.min(SCREENSHOT_DIALOG_MIN_WIDTH, max);
  return clampNumber(value, min, max);
}

function getInitialReportPaneWidth(): number {
  if (typeof window === 'undefined') return REPORT_PANE_DEFAULT_WIDTH;
  try {
    const stored = Number(
      window.localStorage.getItem(REPORT_PANE_WIDTH_STORAGE_KEY),
    );
    return clampReportPaneWidth(stored || REPORT_PANE_DEFAULT_WIDTH);
  } catch {
    return REPORT_PANE_DEFAULT_WIDTH;
  }
}

function getInitialScreenshotDialogWidth(): number {
  if (typeof window === 'undefined') return SCREENSHOT_DIALOG_DEFAULT_WIDTH;
  try {
    const stored = Number(
      window.localStorage.getItem(SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY),
    );
    return clampScreenshotDialogWidth(
      stored || SCREENSHOT_DIALOG_DEFAULT_WIDTH,
    );
  } catch {
    return clampScreenshotDialogWidth(SCREENSHOT_DIALOG_DEFAULT_WIDTH);
  }
}

function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  );
}

function isConfiguredServerEndpoint(endpoint: URL): boolean {
  return endpoint.origin === GENUI_SERVER_URL;
}

function resolveTrustedA2UIEndpoint(raw: string): string | null {
  try {
    const endpoint = new URL(raw, window.location.origin);
    if (endpoint.origin === window.location.origin) return endpoint.toString();
    if (isConfiguredServerEndpoint(endpoint)) return endpoint.toString();
    const isTrustedDevEndpoint = endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_A2UI_SERVER_PORT
      && isDevHost(endpoint.hostname);
    return isTrustedDevEndpoint ? endpoint.toString() : null;
  } catch {
    return null;
  }
}

function toBenchJobsEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint, window.location.origin);
    url.pathname = '/a2ui/bench/jobs';
    url.search = '';
    return url.toString();
  } catch {
    return endpoint;
  }
}

function getA2UIBenchJobsEndpoint(): string {
  const params = new URLSearchParams(window.location.search);
  const fromBenchQuery = params.get('a2uiBenchEndpoint');
  if (fromBenchQuery) {
    const trustedEndpoint = resolveTrustedA2UIEndpoint(fromBenchQuery);
    if (trustedEndpoint) return toBenchJobsEndpoint(trustedEndpoint);
  }

  const fromChatQuery = params.get('a2uiEndpoint');
  if (fromChatQuery) {
    const trustedEndpoint = resolveTrustedA2UIEndpoint(fromChatQuery);
    if (trustedEndpoint) return toBenchJobsEndpoint(trustedEndpoint);
  }

  return buildGenuiServerUrl('a2ui/bench/jobs');
}

function getA2UIBenchHealthEndpoint(): string {
  const jobsEndpoint = getA2UIBenchJobsEndpoint();
  try {
    const url = new URL(jobsEndpoint, window.location.origin);
    url.pathname = '/a2ui/health';
    url.search = '';
    return url.toString();
  } catch {
    return buildGenuiServerUrl('a2ui/health');
  }
}

function getA2UIBenchReportEndpoint(jobId: string): string {
  const jobsEndpoint = getA2UIBenchJobsEndpoint();
  try {
    const url = new URL(jobsEndpoint, window.location.origin);
    url.pathname = `/a2ui/bench/jobs/${encodeURIComponent(jobId)}/report`;
    url.search = '';
    return url.toString();
  } catch {
    return buildGenuiServerUrl(
      `a2ui/bench/jobs/${encodeURIComponent(jobId)}/report`,
    );
  }
}

function getA2UIBenchJobEndpoint(jobId: string): string {
  const jobsEndpoint = getA2UIBenchJobsEndpoint();
  return `${jobsEndpoint}/${encodeURIComponent(jobId)}`;
}

type BenchJobCancellationDisposition = 'cleared' | 'retry';

export function getBenchJobCancellationDisposition(response: {
  ok: boolean;
  status: number;
}): BenchJobCancellationDisposition {
  return response.ok || response.status === 404 ? 'cleared' : 'retry';
}

export function createBenchJobCancellationRequestInit(): RequestInit {
  return {
    method: 'DELETE',
    keepalive: true,
  };
}

export function shouldCancelCreatedBenchJob(
  createdOperationId: number,
  currentOperationId: number,
): boolean {
  return createdOperationId !== currentOperationId;
}

async function requestBenchJobCancellation(
  jobId: string,
): Promise<BenchJobCancellationDisposition> {
  try {
    const response = await window.fetch(
      getA2UIBenchJobEndpoint(jobId),
      createBenchJobCancellationRequestInit(),
    );
    return getBenchJobCancellationDisposition(response);
  } catch {
    return 'retry';
  }
}

function getA2UIBenchJobIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromSearch = params.get('a2uiBenchJobId') ?? params.get('benchJobId');
  if (fromSearch) return fromSearch;

  const hashQueryIndex = window.location.hash.indexOf('?');
  if (hashQueryIndex === -1) return null;
  const hashParams = new URLSearchParams(
    window.location.hash.slice(hashQueryIndex + 1),
  );
  return hashParams.get('a2uiBenchJobId') ?? hashParams.get('benchJobId');
}

function getA2UIBenchRecoveryUrl(jobId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('a2uiBenchJobId', jobId);
  url.hash = '#/bench';
  return url.toString();
}

function getA2UIPlaygroundBaseUrl(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) {
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1] ?? '';
    url.pathname = last.includes('.')
      ? url.pathname.replace(/[^/]*$/u, '')
      : `${url.pathname}/`;
  }
  return url.toString();
}

function canForwardApiKeyToEndpoint(raw: string): boolean {
  try {
    const endpoint = new URL(raw, window.location.origin);
    const isConfiguredDevEndpoint = endpoint.origin === GENUI_SERVER_URL
      && endpoint.protocol === 'http:'
      && isDevHost(endpoint.hostname);
    const isLegacyDevEndpoint = endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_A2UI_SERVER_PORT
      && isDevHost(endpoint.hostname);
    return isConfiguredDevEndpoint || isLegacyDevEndpoint;
  } catch {
    return false;
  }
}

function filterProviderForEndpoint(
  env: BenchEnv,
  endpoint: string,
): Partial<BenchEnv> {
  const apiKey = env.apiKey.trim();
  const baseURL = env.baseURL.trim();
  const model = env.model.trim();
  return {
    ...(apiKey && canForwardApiKeyToEndpoint(endpoint) ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(model ? { model } : {}),
  };
}

function isProviderConfigured(env: BenchEnv): boolean {
  const apiKey = env.apiKey.trim();
  const baseURL = env.baseURL.trim();
  const model = env.model.trim();
  return Boolean(apiKey)
    || (baseURL.length > 0 && baseURL !== DEFAULT_ENV.baseURL)
    || (model.length > 0 && model !== DEFAULT_ENV.model);
}

function getBenchHealthKeyLabel(
  health: BenchHealth | null,
  healthError: BenchHealthError | null,
  locale: BenchLocale = 'zh-CN',
): string {
  if (health) {
    return health.hasKey
      ? benchText(locale, '已配置', 'Configured')
      : benchText(locale, '未配置', 'Not configured');
  }
  if (healthError) return benchText(locale, '状态未知', 'Unknown');
  return benchText(locale, '检查中…', 'Checking…');
}

function getBenchImageHealthLabel(
  health: BenchHealth | null,
  locale: BenchLocale = 'zh-CN',
): string {
  if (!health) return benchText(locale, '检查中…', 'Checking…');
  return health.imageGenerationReady
    ? benchText(locale, '已配置', 'Configured')
    : benchText(locale, '未配置', 'Not configured');
}

function getBenchHealthErrorText(
  error: BenchHealthError,
  locale: BenchLocale,
): string {
  return error.kind === 'status'
    ? benchText(
      locale,
      `Provider 状态检查失败：${error.status}`,
      `Provider status check failed: ${error.status}`,
    )
    : error.message;
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function cloneBenchGroups(groups: BenchGroup[]): BenchGroup[] {
  return groups.map((group) => ({ ...group }));
}

function cloneBenchScenarios(scenarios: BenchScenario[]): BenchScenario[] {
  return scenarios.map((scenario) => ({ ...scenario }));
}

function createBenchRequestGroups(
  groups: BenchGroup[],
): BenchGroup[] {
  return groups.map((group) => ({
    id: group.id,
    role: group.role,
    protocol: group.protocol,
    profile: group.profile,
    name: group.name,
    variable: group.variable,
    model: group.model,
    catalog: group.catalog,
    extraInstruction: group.extraInstruction,
    enabled: group.enabled,
  }));
}

function createBenchRequestScenarios(
  scenarios: BenchScenario[],
): BenchScenario[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    prompt: scenario.prompt,
    type: scenario.type,
    complexity: scenario.complexity,
    action: scenario.action,
  }));
}

function cloneBenchSettings(settings: BenchSettings): BenchSettings {
  return { ...settings };
}

function createBenchPlanSignature(
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  settings: BenchSettings,
  env: {
    apiKey?: string;
    apiKeyConfigured?: boolean;
    baseURL: string;
    model: string;
  },
): string {
  return JSON.stringify({
    groups: groups.map((group) => ({
      id: group.id,
      role: group.role,
      protocol: group.protocol,
      profile: group.profile,
      name: group.name,
      model: group.model,
      catalog: usesCatalog(group) ? group.catalog : undefined,
      extraInstruction: group.extraInstruction,
      enabled: group.enabled,
    })),
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      prompt: scenario.prompt,
      type: scenario.type,
      complexity: scenario.complexity,
      action: scenario.action,
    })),
    settings,
    provider: {
      apiKeyConfigured: env.apiKey === undefined
        ? Boolean(env.apiKeyConfigured)
        : Boolean(env.apiKey.trim()),
      baseURL: env.baseURL,
      model: env.model,
    },
  });
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isBenchRole(value: unknown): value is BenchRole {
  return value === 'control' || value === 'experiment';
}

function isBenchVariable(value: unknown): value is BenchVariable {
  return value === 'protocol'
    || value === 'model'
    || value === 'prompt'
    || value === 'catalog'
    || value === 'custom';
}

function isBenchProtocol(value: unknown): value is BenchProtocol {
  return value === 'a2ui' || value === 'openui';
}

function isBenchProfile(value: unknown): value is BenchProfile {
  return value === 'native' || value === 'matched-core';
}

function createBenchSettingsFromReport(report: BenchReport): BenchSettings {
  const reportSettings = (report.settings ?? {}) as BenchReportSettingsPayload;
  return {
    repeats: readFiniteNumber(reportSettings.repeats, DEFAULT_SETTINGS.repeats),
    parallelism: readFiniteNumber(
      reportSettings.parallelism,
      DEFAULT_SETTINGS.parallelism,
    ),
    repairEnabled: readBoolean(
      reportSettings.repairEnabled,
      DEFAULT_SETTINGS.repairEnabled,
    ),
    judgeEnabled: readBoolean(
      reportSettings.judgeEnabled,
      DEFAULT_SETTINGS.judgeEnabled,
    ),
    collectLiveRenderMetrics: readBoolean(
      reportSettings.collectLiveRenderMetrics,
      readBoolean(
        reportSettings.renderMetricsEnabled,
        DEFAULT_SETTINGS.collectLiveRenderMetrics,
      ),
    ),
  };
}

function createBenchGroupsFromReport(report: BenchReport): BenchGroup[] {
  const fallbackModel = report.env?.model ?? DEFAULT_ENV.model;
  const reportGroups = Array.isArray(report.groups) ? report.groups : [];
  const groups = reportGroups.map((group, index) => {
    const item = group as Partial<BenchGroup>;
    const protocol = isBenchProtocol(item.protocol)
      ? item.protocol
      : 'a2ui';
    return {
      id: item.id ?? createId(`history-group-${index + 1}`),
      role: isBenchRole(item.role) ? item.role : 'experiment',
      protocol,
      profile: isBenchProfile(item.profile)
        ? item.profile
        : (protocol === 'openui' ? 'matched-core' : 'native'),
      name: item.name ?? `Group ${index + 1}`,
      variable: isBenchVariable(item.variable) ? item.variable : 'custom',
      model: item.model ?? fallbackModel,
      catalog: item.catalog ?? 'Full Catalog',
      extraInstruction: item.extraInstruction ?? '',
      enabled: readBoolean(item.enabled, true),
    };
  });
  return groups.length > 0
    ? restoreBenchGroupSystemNames(groups)
    : cloneBenchGroups(getBenchGroupPreset('a2ui-variants'));
}

function createBenchScenariosFromReport(report: BenchReport): BenchScenario[] {
  const reportScenarios = Array.isArray(report.scenarios)
    ? report.scenarios
    : [];
  const scenarios = reportScenarios.map((scenario, index) => {
    const item = scenario as Partial<BenchScenario>;
    return {
      id: item.id ?? createId(`history-scenario-${index + 1}`),
      name: item.name ?? `Scenario ${index + 1}`,
      prompt: item.prompt ?? '',
      type: item.type ?? 'Custom',
      complexity: readFiniteNumber(item.complexity, 1),
      action: item.action ?? '',
    };
  });
  return scenarios.length > 0
    ? restoreBenchScenarioSystemTexts(scenarios)
    : cloneBenchScenarios(DEFAULT_SCENARIOS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBenchHistoryEntry(value: unknown): value is BenchHistoryEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  if (!isRecord(value.report) || !isRecord(value.config)) return false;
  return Array.isArray(value.report.summaries)
    && Array.isArray(value.report.results)
    && isRecord(value.config.env)
    && isRecord(value.config.settings)
    && Array.isArray(value.config.groups)
    && Array.isArray(value.config.scenarios);
}

export function readBenchHistory(): BenchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BENCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const entries = migrateBenchHistoryEntries(parsed);
    persistBenchHistory(entries);
    return entries;
  } catch {
    return [];
  }
}

function persistBenchHistory(entries: BenchHistoryEntry[]): void {
  try {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      serializeBenchHistoryEntries(entries),
    );
  } catch {
    // History is a convenience layer; quota/private-mode failures should not
    // block a benchmark run.
  }
}

function createBenchHistoryEntry(
  report: BenchReport,
  env: BenchEnv,
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  settings: BenchSettings,
): BenchHistoryEntry {
  const totalRuns = report.summary?.totalRuns ?? report.results.length;
  const protocols = [
    ...new Set(
      createBenchGroupsFromReport(report).map((group) =>
        group.protocol === 'openui' ? 'OpenUI' : 'A2UI'
      ),
    ),
  ];
  return {
    id: createId('bench-history'),
    title: `${protocols.join(' + ')} · ${totalRuns} Runs`,
    savedAt: new Date().toISOString(),
    report: sanitizeBenchReportValue(report, [env.apiKey]) as BenchReport,
    config: {
      env: {
        apiKeyConfigured: Boolean(env.apiKey.trim())
          || report.env.apiKeyConfigured,
        model: env.model || report.env.model,
      },
      settings: cloneBenchSettings(settings),
      groups: cloneBenchGroups(groups),
      scenarios: cloneBenchScenarios(scenarios),
    },
  };
}

function createBenchHistoryEntryFromReport(
  report: BenchReport,
): BenchHistoryEntry {
  return createBenchHistoryEntry(
    report,
    {
      apiKey: '',
      baseURL: DEFAULT_ENV.baseURL,
      model: report.env?.model || DEFAULT_ENV.model,
    },
    createBenchGroupsFromReport(report),
    createBenchScenariosFromReport(report),
    createBenchSettingsFromReport(report),
  );
}

function upsertBenchHistoryEntry(
  entries: BenchHistoryEntry[],
  entry: BenchHistoryEntry,
): BenchHistoryEntry[] {
  const next = entries.filter((item) => {
    const sameJob = Boolean(entry.report.jobId)
      && item.report.jobId === entry.report.jobId;
    return !sameJob && item.report.id !== entry.report.id;
  });
  return [entry, ...next].slice(0, BENCH_HISTORY_LIMIT);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function shouldApplyBenchReportRequest(
  controller: AbortController,
  activeController: AbortController | null,
): boolean {
  return !controller.signal.aborted && activeController === controller;
}

function isSensitiveBenchReportKey(key: string): boolean {
  const normalized = key.replaceAll(/[-_]/gu, '').toLowerCase();
  return normalized === 'apikey'
    || normalized === 'authorization'
    || normalized === 'accesstoken'
    || normalized === 'token'
    || normalized === 'secret'
    || normalized === 'baseurl'
    || normalized === 'screenshotdataurl';
}

function redactBenchReportString(
  value: string,
  secrets: readonly string[],
): string {
  let sanitized = value;
  for (
    const secret of new Set(
      secrets.map((item) => item.trim()).filter(
        Boolean,
      ),
    )
  ) {
    sanitized = sanitized.replaceAll(secret, '[redacted credential]');
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) {
      sanitized = sanitized.replaceAll(encoded, '[redacted credential]');
    }
  }
  return sanitized
    .replace(/https?:\/\/[^\s"'<>]+/giu, '[redacted URL]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [redacted]')
    .replace(
      /\b(?:OPENAI_API_KEY|API[_-]?KEY|AUTHORIZATION|ACCESS[_-]?TOKEN|SECRET)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      'credential=[redacted]',
    )
    .replace(/\b(?:sk-[\w-]{8,}|[\w+/=-]{32,})\b/gu, '[redacted credential]');
}

function sanitizeBenchReportValue(
  value: unknown,
  secrets: readonly string[] = [],
): unknown {
  if (typeof value === 'string') {
    return redactBenchReportString(value, secrets);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeBenchReportValue(item, secrets));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      isSensitiveBenchReportKey(key)
        ? []
        : [[key, sanitizeBenchReportValue(item, secrets)]]
    ),
  );
}

export function migrateBenchHistoryEntries(
  value: unknown,
): BenchHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => isBenchHistoryEntry(entry)).map((entry) => {
    const safeReport = sanitizeBenchReportValue(entry.report) as BenchReport;
    const configReport = {
      ...safeReport,
      groups: entry.config.groups,
      scenarios: entry.config.scenarios,
      settings: entry.config.settings,
    };
    return {
      ...entry,
      report: safeReport,
      config: {
        env: {
          apiKeyConfigured: Boolean(entry.config.env.apiKeyConfigured),
          model: entry.config.env.model ?? DEFAULT_ENV.model,
        },
        groups: createBenchGroupsFromReport(configReport),
        scenarios: createBenchScenariosFromReport(configReport),
        settings: createBenchSettingsFromReport(configReport),
      },
    };
  }).slice(0, BENCH_HISTORY_LIMIT);
}

export function serializeBenchHistoryEntries(
  entries: BenchHistoryEntry[],
): string {
  const persistableEntries = entries.slice(0, BENCH_HISTORY_LIMIT).map(
    (entry) => ({
      ...entry,
      report: sanitizeBenchReportValue(entry.report),
      config: {
        groups: entry.config.groups,
        scenarios: entry.config.scenarios,
        settings: entry.config.settings,
        env: {
          apiKeyConfigured: entry.config.env.apiKeyConfigured,
          model: entry.config.env.model,
        },
      },
    }),
  );
  return JSON.stringify(persistableEntries);
}

export function serializeBenchReport(
  report: BenchReport,
  secrets: readonly string[] = [],
): string {
  return JSON.stringify(sanitizeBenchReportValue(report, secrets), null, 2);
}

function readEventData<T>(event: MessageEvent<unknown>): T | null {
  if (typeof event.data !== 'string') return null;
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

function deltaText(value: number, baseline: number, suffix = ''): string {
  if (baseline === 0) return 'n/a';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%${suffix}`;
}

function getRunButtonText(
  status: BenchStatus,
  locale: BenchLocale = 'zh-CN',
): string {
  if (status === 'running') return benchText(locale, '运行中', 'Running');
  if (status === 'failed') return benchText(locale, '重新运行', 'Run again');
  return benchText(locale, '运行 Bench', 'Run Bench');
}

function getProgressWidth(
  status: BenchStatus,
  progress: number,
  report: BenchReport | null,
): number {
  if (status === 'idle' && !report) return 0;
  if (status === 'running') return progress;
  return progress > 0 ? progress : 100;
}

function getRunMetaText(
  status: BenchStatus,
  progress: number,
  runMessage: BenchRunMessage,
  runCount: number,
  locale: BenchLocale = 'zh-CN',
): string {
  if (status === 'running') {
    return `${Math.round(progress)}% · ${
      getBenchRunMessageText(runMessage, locale)
    }`;
  }
  if (status === 'idle') {
    return benchText(
      locale,
      `计划运行 ${runCount} Runs`,
      `${runCount} runs planned`,
    );
  }
  return getBenchRunMessageText(runMessage, locale);
}

function getReportSubtitle(
  report: BenchReport | null,
  reportIsStale: boolean,
  locale: BenchLocale = 'zh-CN',
): string {
  if (!report) return benchText(locale, '暂无报告', 'No report yet');
  if (reportIsStale) {
    return benchText(
      locale,
      '当前计划已变更 · 显示上次 Report',
      'Plan changed · Showing the previous report',
    );
  }
  return new Date(report.createdAt).toLocaleString(
    locale === 'en-US' ? 'en-US' : 'zh-CN',
  );
}

function formatSummaryJudgeMetric(
  report: BenchReport,
  settings: BenchSettings,
  summary: BenchGroupSummary,
): string {
  if (!settings.judgeEnabled || report.capabilities?.judge === 'disabled') {
    return 'off';
  }
  if (summary.judgeRunCount === 0) return 'n/a';
  const visual = `${summary.avgJudgeScore.toFixed(1)}/5`;
  return summary.avgJudgeGeqiScore === undefined
    ? visual
    : `${visual} · ${summary.avgJudgeGeqiScore.toFixed(1)}/100 GEQI`;
}

function formatRunJudgeMetric(
  report: BenchReport,
  settings: BenchSettings,
  result: BenchResult,
): string {
  if (!settings.judgeEnabled || report.capabilities?.judge === 'disabled') {
    return 'off';
  }
  if (result.judgeStatus === 'failed') return 'error';
  if (result.judgeStatus === 'skipped') return 'n/a';
  const visual = `${result.judgeScore.toFixed(1)}/5`;
  return result.judgeGeqiScore === undefined
    ? visual
    : `${visual} · ${result.judgeGeqiScore.toFixed(1)}/100 GEQI`;
}

function isBenchRunFailed(result: BenchResult): boolean {
  return result.status === 'failed' || result.ok === false;
}

function getScreenshotState(
  result: BenchResult,
): BenchScreenshotState {
  if (result.screenshotDataUrl) return 'captured';
  if (isBenchRunFailed(result)) return 'failed';
  return 'missing';
}

function getScreenshotStateLabelFromState(
  state: BenchScreenshotState,
  locale: BenchLocale = 'zh-CN',
): string {
  if (state === 'captured') return benchText(locale, '已截图', 'Captured');
  if (state === 'failed') return benchText(locale, '运行失败', 'Run failed');
  return benchText(locale, '无截图', 'No screenshot');
}

function getScreenshotPlaceholderText(
  result: BenchResult | null,
  locale: BenchLocale = 'zh-CN',
): string {
  if (!result) {
    return benchText(
      locale,
      '这个位置没有收到 Bench 结果。',
      'No Bench result was received for this slot.',
    );
  }
  if (isBenchRunFailed(result)) {
    return result.error
      ?? result.errors?.[0]
      ?? benchText(
        locale,
        '截图前运行已失败。',
        'The run failed before a screenshot was captured.',
      );
  }
  return result.errors?.find((error) =>
    error.toLowerCase().includes('screenshot')
  ) ?? benchText(
    locale,
    '这次运行没有保存截图。',
    'This run did not save a screenshot.',
  );
}

function createBenchGroupsForMatrix(report: BenchReport): BenchGroup[] {
  const reportGroups = Array.isArray(report.groups) ? report.groups : [];
  if (reportGroups.length > 0) {
    return createBenchGroupsFromReport(report);
  }

  const seen = new Set<string>();
  const groupsFromResults = report.results.flatMap((result) => {
    if (seen.has(result.groupId)) return [];
    seen.add(result.groupId);
    return [{
      id: result.groupId,
      role: result.role,
      protocol: result.protocol ?? 'a2ui',
      profile: result.profile
        ?? (result.protocol === 'openui' ? 'matched-core' : 'native'),
      name: result.groupName,
      variable: 'custom' as BenchVariable,
      model: result.model ?? report.env?.model ?? DEFAULT_ENV.model,
      catalog: result.catalog ?? 'Full Catalog',
      extraInstruction: '',
      enabled: true,
    }];
  });
  return groupsFromResults.length > 0
    ? restoreBenchGroupSystemNames(groupsFromResults)
    : cloneBenchGroups(getBenchGroupPreset('a2ui-variants'));
}

function createBenchScenariosForMatrix(report: BenchReport): BenchScenario[] {
  const reportScenarios = Array.isArray(report.scenarios)
    ? report.scenarios
    : [];
  if (reportScenarios.length > 0) {
    return createBenchScenariosFromReport(report);
  }

  const seen = new Set<string>();
  const scenariosFromResults = report.results.flatMap((result) => {
    if (seen.has(result.scenarioId)) return [];
    seen.add(result.scenarioId);
    return [{
      id: result.scenarioId,
      name: result.scenarioName,
      prompt: '',
      type: 'Custom',
      systemType: 'custom' as const,
      complexity: 1,
      action: '',
    }];
  });
  return scenariosFromResults.length > 0
    ? scenariosFromResults
    : cloneBenchScenarios(DEFAULT_SCENARIOS);
}

function createBenchScreenshotMatrix(
  report: BenchReport | null,
): BenchScreenshotMatrix {
  if (!report) {
    return {
      rows: [],
      scenarios: [],
      repeatCount: 1,
      total: 0,
      captured: 0,
      failed: 0,
      missing: 0,
    };
  }

  const matrixGroups = createBenchGroupsForMatrix(report);
  const matrixScenarios = createBenchScenariosForMatrix(report);
  const repeatCount = Math.max(
    1,
    createBenchSettingsFromReport(report).repeats,
  );
  const resultsByCell = new Map<string, BenchResult[]>();
  for (const result of report.results) {
    const key = `${result.groupId}:${result.scenarioId}`;
    const results = resultsByCell.get(key) ?? [];
    results.push(result);
    resultsByCell.set(key, results);
  }

  let captured = 0;
  let failed = 0;
  let missing = 0;
  const rows = matrixGroups.map((group) => {
    const cells = matrixScenarios.map((scenario) => {
      const results = [
        ...(resultsByCell.get(`${group.id}:${scenario.id}`) ?? []),
      ].sort((a, b) => (a.repeatIndex ?? 1) - (b.repeatIndex ?? 1));
      const slots = Array.from({ length: repeatCount }, (_, index) => {
        const repeatIndex = index + 1;
        const result = results.find((item) =>
          (item.repeatIndex ?? 1) === repeatIndex
        ) ?? null;
        const state = result ? getScreenshotState(result) : 'missing';
        if (state === 'captured') captured += 1;
        else if (state === 'failed') failed += 1;
        else missing += 1;
        return {
          key: result?.id ?? `${group.id}:${scenario.id}:${repeatIndex}`,
          repeatIndex,
          result,
          state,
        };
      });
      return {
        key: `${group.id}:${scenario.id}`,
        group,
        scenario,
        slots,
      };
    });
    return {
      key: group.id,
      group,
      cells,
    };
  });

  return {
    rows,
    scenarios: matrixScenarios,
    repeatCount,
    total: matrixGroups.length * matrixScenarios.length * repeatCount,
    captured,
    failed,
    missing,
  };
}

function groupPatch<K extends keyof BenchGroup>(
  key: K,
  value: BenchGroup[K],
): Pick<BenchGroup, K> {
  return { [key]: value } as Pick<BenchGroup, K>;
}

function usesCatalog(group: BenchGroup): boolean {
  return group.protocol === 'a2ui' && group.profile === 'native';
}

function getBaselineCompatibilityScore(
  candidate: BenchGroup,
  group: BenchGroup,
): number {
  const catalogMatches = usesCatalog(candidate) && usesCatalog(group)
    && candidate.catalog === group.catalog;
  return Number(candidate.profile === group.profile) * 8
    + Number(candidate.model === group.model) * 4
    + Number(candidate.protocol === group.protocol) * 2
    + Number(catalogMatches);
}

function findComparableBaseline(
  group: BenchGroup,
  groups: BenchGroup[],
): BenchGroup | undefined {
  if (group.role === 'control') return group;

  const controls = groups.filter((candidate) =>
    candidate.role === 'control' && candidate.id !== group.id
  );
  return controls.sort((left, right) => {
    return getBaselineCompatibilityScore(right, group)
      - getBaselineCompatibilityScore(left, group);
  })[0];
}

function getBenchGroupDifferences(
  group: BenchGroup,
  baseline: BenchGroup | undefined,
): string[] {
  if (!baseline || group.id === baseline.id) return [];

  const differences: string[] = [];
  if (group.protocol !== baseline.protocol) differences.push('Protocol');
  if (group.profile !== baseline.profile) differences.push('Profile');
  if (group.model !== baseline.model) differences.push('Model');
  if (
    usesCatalog(group) && usesCatalog(baseline)
    && group.catalog !== baseline.catalog
  ) {
    differences.push('Catalog');
  }
  if (group.extraInstruction !== baseline.extraInstruction) {
    differences.push('Prompt');
  }
  return differences;
}

function inferBenchVariable(
  group: BenchGroup,
  baseline: BenchGroup | undefined,
): BenchVariable {
  const differences = getBenchGroupDifferences(group, baseline);
  if (differences.length !== 1) return 'custom';
  const [difference] = differences;
  if (difference === 'Protocol') return 'protocol';
  if (difference === 'Model') return 'model';
  if (difference === 'Catalog') return 'catalog';
  if (difference === 'Prompt') return 'prompt';
  return 'custom';
}

export function getBenchRunBlockers(
  activeGroupCount: number,
  enabledControlCount: number,
  scenarioCount: number,
  repeats: number,
  locale: BenchLocale = 'zh-CN',
): string[] {
  const issues: string[] = [];
  if (activeGroupCount === 0) {
    issues.push(
      benchText(
        locale,
        '至少启用一个对比组。',
        'Enable at least one comparison group.',
      ),
    );
  } else if (enabledControlCount === 0) {
    issues.push(
      benchText(
        locale,
        '至少启用一个基准组。',
        'Enable at least one baseline group.',
      ),
    );
  }
  if (scenarioCount === 0) {
    issues.push(
      benchText(locale, '至少添加一个场景。', 'Add at least one scenario.'),
    );
  }
  if (repeats < 1) {
    issues.push(
      benchText(
        locale,
        'Repeats 不能小于 1。',
        'Repeats must be at least 1.',
      ),
    );
  }
  return issues;
}

interface BenchDropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

function BenchDropdown<T extends string>(props: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  options: readonly BenchDropdownOption<T>[];
  value: T;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = props.options.find((option) => option.value === props.value)
    ?? props.options[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      className='benchDropdown'
      data-disabled={props.disabled ?? undefined}
      data-open={open ? true : undefined}
      ref={rootRef}
    >
      <button
        type='button'
        className='benchDropdownTrigger'
        aria-expanded={open}
        aria-label={props.ariaLabel}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? props.value}</span>
      </button>
      {open && !props.disabled
        ? (
          <div
            className='benchDropdownMenu'
            role='group'
            aria-label={props.ariaLabel}
          >
            {props.options.map((option) => (
              <button
                type='button'
                aria-pressed={option.value === props.value}
                data-selected={option.value === props.value || undefined}
                key={option.value}
                onClick={() => {
                  props.onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.description
                  ? <small>{option.description}</small>
                  : null}
              </button>
            ))}
          </div>
        )
        : null}
    </div>
  );
}

interface BenchPageProps {
  locale?: BenchLocale;
  showHeader?: boolean;
}

export function BenchPage({
  locale = 'zh-CN',
  showHeader = true,
}: BenchPageProps) {
  const [env, setEnv] = useState<BenchEnv>(DEFAULT_ENV);
  const [groups, setGroups] = useState<BenchGroup[]>(EMPTY_GROUPS);
  const [scenarios, setScenarios] = useState<BenchScenario[]>(
    DEFAULT_SCENARIOS,
  );
  const [settings, setSettings] = useState<BenchSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<BenchStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [runMessage, setRunMessage] = useState<BenchRunMessage>({
    code: 'ready',
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [benchRunNoticeOpen, setBenchRunNoticeOpen] = useState(false);
  const [benchHealth, setBenchHealth] = useState<BenchHealth | null>(null);
  const [benchHealthError, setBenchHealthError] = useState<
    BenchHealthError | null
  >(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [reportPaneWidth, setReportPaneWidth] = useState(
    getInitialReportPaneWidth,
  );
  const [screenshotDialogWidth, setScreenshotDialogWidth] = useState(
    getInitialScreenshotDialogWidth,
  );
  const [isResizingReport, setIsResizingReport] = useState(false);
  const [isResizingScreenshotDialog, setIsResizingScreenshotDialog] = useState(
    false,
  );
  const [report, setReport] = useState<BenchReport | null>(null);
  const [reportPlanSignature, setReportPlanSignature] = useState<string | null>(
    null,
  );
  const [historyItems, setHistoryItems] = useState<BenchHistoryEntry[]>(
    readBenchHistory,
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [historyCopyId, setHistoryCopyId] = useState<string | null>(null);
  const benchBodyRef = useRef<HTMLDivElement | null>(null);
  const screenshotDialogRef = useRef<HTMLElement | null>(null);
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const eventSourceRef = useRef<EventSource | null>(null);
  const historyReportAbortRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const pendingCancellationJobIdsRef = useRef<Set<string>>(new Set());
  const benchOperationIdRef = useRef(0);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.enabled),
    [groups],
  );
  const configuredControlGroupCount = useMemo(
    () => groups.filter((group) => group.role === 'control').length,
    [groups],
  );
  const enabledControlGroupCount = useMemo(
    () => activeGroups.filter((group) => group.role === 'control').length,
    [activeGroups],
  );
  const runGroups = useMemo(
    () =>
      activeGroups.map((group) => ({
        ...group,
        variable: inferBenchVariable(
          group,
          findComparableBaseline(group, activeGroups),
        ),
      })),
    [activeGroups],
  );
  const activeProtocols = useMemo(
    () => [...new Set(activeGroups.map((group) => group.protocol))],
    [activeGroups],
  );
  const groupBaselines = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          group.id,
          findComparableBaseline(group, activeGroups),
        ]),
      ),
    [activeGroups, groups],
  );
  const groupDifferences = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          group.id,
          getBenchGroupDifferences(group, groupBaselines.get(group.id)),
        ]),
      ),
    [groupBaselines, groups],
  );
  const runCount = activeGroups.length * scenarios.length * settings.repeats;
  const planLocked = status === 'running';
  const planSignature = useMemo(
    () => createBenchPlanSignature(runGroups, scenarios, settings, env),
    [env, runGroups, scenarios, settings],
  );
  const reportIsStale = Boolean(
    report && reportPlanSignature !== planSignature,
  );
  const reportSettings = useMemo(
    () => report ? createBenchSettingsFromReport(report) : settings,
    [report, settings],
  );
  const activeScenarioTypes = useMemo(
    () => [
      ...new Set(
        scenarios.map((scenario) =>
          getBenchScenarioFieldText(
            scenario.type,
            scenario.systemType,
            locale,
          )
        ),
      ),
    ],
    [locale, scenarios],
  );
  const providerConfigured = useMemo(() => isProviderConfigured(env), [env]);
  const benchRunBlockers = useMemo(
    () =>
      getBenchRunBlockers(
        activeGroups.length,
        enabledControlGroupCount,
        scenarios.length,
        settings.repeats,
        locale,
      ),
    [
      activeGroups.length,
      enabledControlGroupCount,
      scenarios.length,
      settings.repeats,
      locale,
    ],
  );

  const clearActiveJobConnection = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    historyReportAbortRef.current?.abort();
    historyReportAbortRef.current = null;
  }, []);

  const cancelBenchJobs = useCallback(async (
    jobIds: readonly string[],
    notify: boolean,
  ): Promise<boolean> => {
    const uniqueJobIds = [...new Set(jobIds)];
    for (const jobId of uniqueJobIds) {
      pendingCancellationJobIdsRef.current.add(jobId);
    }
    const results = await Promise.all(
      uniqueJobIds.map(async (jobId) => ({
        jobId,
        disposition: await requestBenchJobCancellation(jobId),
      })),
    );
    const failedJobIds: string[] = [];
    for (const result of results) {
      if (result.disposition === 'cleared') {
        pendingCancellationJobIdsRef.current.delete(result.jobId);
        if (activeJobIdRef.current === result.jobId) {
          activeJobIdRef.current = null;
        }
      } else {
        failedJobIds.push(result.jobId);
      }
    }
    if (notify && failedJobIds.length > 0) {
      setRunMessage({
        code: 'cancellation-failed',
        jobId: failedJobIds[0].slice(0, 8),
      });
    }
    return failedJobIds.length === 0;
  }, []);

  const cancelActiveBenchJob = useCallback((options?: {
    invalidatePendingStart?: boolean;
    notify?: boolean;
  }): Promise<boolean> => {
    if (options?.invalidatePendingStart !== false) {
      benchOperationIdRef.current += 1;
    }
    const jobId = activeJobIdRef.current;
    clearActiveJobConnection();
    const jobIds = [...pendingCancellationJobIdsRef.current];
    if (jobId) jobIds.push(jobId);
    if (jobIds.length === 0) return Promise.resolve(true);
    return cancelBenchJobs(jobIds, options?.notify !== false);
  }, [cancelBenchJobs, clearActiveJobConnection]);

  useEffect(() => {
    return () => {
      void cancelActiveBenchJob({ notify: false });
    };
  }, [cancelActiveBenchJob]);

  useEffect(() => {
    if (
      !benchRunNoticeOpen && !configOpen && !historyOpen && !screenshotsOpen
    ) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setBenchRunNoticeOpen(false);
      setConfigOpen(false);
      setHistoryOpen(false);
      setScreenshotsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [benchRunNoticeOpen, configOpen, historyOpen, screenshotsOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REPORT_PANE_WIDTH_STORAGE_KEY,
        String(reportPaneWidth),
      );
    } catch {
      // Ignore storage failures; resizing should remain a local UI affordance.
    }
  }, [reportPaneWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCREENSHOT_DIALOG_WIDTH_STORAGE_KEY,
        String(screenshotDialogWidth),
      );
    } catch {
      // Ignore storage failures; dialog resizing is still useful per session.
    }
  }, [screenshotDialogWidth]);

  useEffect(() => {
    const clampToBody = () => {
      const containerWidth = benchBodyRef.current?.getBoundingClientRect()
        .width;
      if (!containerWidth) return;
      if (containerWidth <= REPORT_PANE_RESIZE_BREAKPOINT) return;
      setReportPaneWidth((current) =>
        clampReportPaneWidth(current, containerWidth)
      );
    };

    clampToBody();
    window.addEventListener('resize', clampToBody);
    return () => window.removeEventListener('resize', clampToBody);
  }, []);

  useEffect(() => {
    const clampToViewport = () => {
      setScreenshotDialogWidth((current) =>
        clampScreenshotDialogWidth(current)
      );
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, []);

  useEffect(() => {
    const jobId = getA2UIBenchJobIdFromUrl();
    if (!jobId) return;

    let cancelled = false;
    const controller = new AbortController();
    historyReportAbortRef.current?.abort();
    historyReportAbortRef.current = controller;
    setStatus('running');
    setProgress(0);
    setRunMessage({ code: 'loading-report', jobId: jobId.slice(0, 8) });

    void (async () => {
      try {
        const response = await window.fetch(
          getA2UIBenchReportEndpoint(jobId),
          { signal: controller.signal },
        );
        const payload = await response.json().catch(() => ({})) as
          | BenchReport
          | { error?: string };
        if (!response.ok || !('results' in payload)) {
          if ('error' in payload && payload.error) {
            throw new Error(payload.error);
          }
          setStatus('failed');
          setRunMessage({
            code: 'report-load-failed',
            status: response.status,
          });
          return;
        }
        if (
          cancelled
          || !shouldApplyBenchReportRequest(
            controller,
            historyReportAbortRef.current,
          )
        ) {
          return;
        }
        const historyEntry = createBenchHistoryEntryFromReport(payload);
        const restoredEnv = {
          ...DEFAULT_ENV,
          model: historyEntry.config.env.model,
        };
        setReport(payload);
        setReportPlanSignature(
          createBenchPlanSignature(
            historyEntry.config.groups,
            historyEntry.config.scenarios,
            historyEntry.config.settings,
            restoredEnv,
          ),
        );
        setEnv(restoredEnv);
        setGroups(
          restoreBenchGroupSystemNames(
            cloneBenchGroups(historyEntry.config.groups),
          ),
        );
        setScenarios(
          restoreBenchScenarioSystemTexts(
            cloneBenchScenarios(historyEntry.config.scenarios),
          ),
        );
        setSettings(cloneBenchSettings(historyEntry.config.settings));
        setHistoryItems((current) => {
          const next = upsertBenchHistoryEntry(current, historyEntry);
          persistBenchHistory(next);
          return next;
        });
        setStatus(payload.status ?? 'complete');
        setProgress(100);
        setRunMessage({
          code: 'report-loaded',
          failedRuns: payload.summary?.failedRuns,
        });
      } catch (error) {
        if (
          cancelled
          || !shouldApplyBenchReportRequest(
            controller,
            historyReportAbortRef.current,
          )
        ) {
          return;
        }
        setStatus('failed');
        setRunMessage({ code: 'raw', text: getErrorMessage(error) });
      } finally {
        if (historyReportAbortRef.current === controller) {
          historyReportAbortRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (historyReportAbortRef.current === controller) {
        historyReportAbortRef.current = null;
      }
    };
  }, []);

  const updateGroup = useCallback(
    (id: string, patch: Partial<BenchGroup>) => {
      setGroups((current) =>
        current.map((group) => group.id === id ? { ...group, ...patch } : group)
      );
    },
    [],
  );

  const addGroup = useCallback((role: BenchRole) => {
    setGroups((current) => [
      ...current,
      {
        id: createId(role),
        role,
        protocol: 'a2ui',
        profile: 'native',
        name: role === 'control'
          ? 'New baseline'
          : 'New comparison',
        variable: 'custom',
        model: env.model || DEFAULT_ENV.model,
        catalog: 'Full Catalog',
        extraInstruction: '',
        enabled: true,
        systemName: role === 'control'
          ? 'new-baseline'
          : 'new-comparison',
      },
    ]);
  }, [env.model]);

  const loadGroupPreset = useCallback((
    preset: BenchGroupPreset,
  ) => {
    void cancelActiveBenchJob();
    const presetGroups = getBenchGroupPreset(preset);
    setGroups(cloneBenchGroups(presetGroups));
    if (preset === 'protocol-pair' || preset === 'combined') {
      setSettings((current) => ({ ...current, parallelism: 1 }));
    }
    setReport(null);
    setReportPlanSignature(null);
    setStatus('idle');
    setProgress(0);
    setRunMessage({ code: 'preset-loaded' });
  }, [cancelActiveBenchJob]);

  const updateGroupProtocol = useCallback(
    (id: string, protocol: BenchProtocol) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === id
            ? {
              ...group,
              protocol,
              profile: protocol === 'openui'
                ? 'matched-core'
                : group.profile,
              catalog: protocol === 'openui'
                ? 'Core Catalog'
                : group.catalog,
            }
            : group
        )
      );
      if (protocol === 'openui') {
        setSettings((current) => ({ ...current, parallelism: 1 }));
      }
    },
    [],
  );

  const updateGroupProfile = useCallback(
    (id: string, profile: BenchProfile) => {
      setGroups((current) =>
        current.map((group) =>
          group.id === id
            ? {
              ...group,
              profile,
              catalog: profile === 'matched-core'
                ? 'Core Catalog'
                : group.catalog,
            }
            : group
        )
      );
    },
    [],
  );

  const removeGroup = useCallback((id: string) => {
    setGroups((current) => {
      const next = current.filter((group) => group.id !== id);
      if (
        next.length > 0
        && !next.some((group) => group.role === 'control')
      ) {
        return next.map((group, index) =>
          index === 0 ? { ...group, role: 'control' } : group
        );
      }
      return next;
    });
  }, []);

  const updateScenario = useCallback(
    (id: string, patch: Partial<BenchScenario>) => {
      setScenarios((current) =>
        current.map((scenario) =>
          scenario.id === id ? { ...scenario, ...patch } : scenario
        )
      );
    },
    [],
  );

  const addScenario = useCallback(() => {
    setScenarios((current) => [
      ...current,
      {
        id: createId('scenario'),
        name: 'Custom scenario',
        prompt: 'Describe the UI to generate and evaluate.',
        type: 'Custom',
        complexity: 1,
        action: 'Primary action',
        systemAction: 'primary-action',
        systemName: 'custom-scenario',
        systemPrompt: 'custom-prompt',
        systemType: 'custom',
      },
    ]);
  }, []);

  const removeScenario = useCallback((id: string) => {
    setScenarios((current) =>
      current.length <= 1
        ? current
        : current.filter((scenario) => scenario.id !== id)
    );
  }, []);

  const resetBench = useCallback(() => {
    void cancelActiveBenchJob();
    setEnv(DEFAULT_ENV);
    setGroups(EMPTY_GROUPS);
    setScenarios(DEFAULT_SCENARIOS);
    setSettings(DEFAULT_SETTINGS);
    setStatus('idle');
    setProgress(0);
    setRunMessage({ code: 'ready' });
    setReport(null);
    setReportPlanSignature(null);
    setBenchHealth(null);
    setBenchHealthError(null);
    setBenchRunNoticeOpen(false);
    setScreenshotsOpen(false);
  }, [cancelActiveBenchJob]);

  const loadBenchHealth = useCallback(() => {
    setBenchHealth(null);
    setBenchHealthError(null);
    void (async () => {
      try {
        const response = await window.fetch(getA2UIBenchHealthEndpoint());
        if (!response.ok) {
          setBenchHealthError({
            kind: 'status',
            status: response.status,
          });
          return;
        }
        const health = await response.json() as BenchHealth;
        setBenchHealth(health);
        if (!health.ok) {
          setBenchHealthError({
            kind: 'raw',
            message: health.error
              ?? benchText(
                locale,
                '服务端默认配置尚未就绪',
                'The server defaults are not ready',
              ),
          });
        }
      } catch (error) {
        setBenchHealthError({
          kind: 'raw',
          message: getErrorMessage(error),
        });
      }
    })();
  }, [locale]);

  const startBench = useCallback((confirmedServerDefaults = false) => {
    if (benchRunBlockers.length > 0 || runCount === 0) {
      setBenchRunNoticeOpen(true);
      setRunMessage({ code: 'run-config-required' });
      return;
    }
    if (!providerConfigured && !confirmedServerDefaults) {
      setBenchRunNoticeOpen(true);
      setRunMessage({ code: 'defaults-confirmation-required' });
      loadBenchHealth();
      return;
    }
    const operationId = ++benchOperationIdRef.current;
    setStatus('running');
    setProgress(0);
    setRunMessage(
      activeJobIdRef.current || pendingCancellationJobIdsRef.current.size > 0
        ? { code: 'stopping-previous-job' }
        : { code: 'creating-job' },
    );
    setReport(null);
    setReportPlanSignature(null);
    setScreenshotsOpen(false);

    void (async () => {
      const previousJobsCancelled = await cancelActiveBenchJob({
        invalidatePendingStart: false,
      });
      if (
        !previousJobsCancelled
        || benchOperationIdRef.current !== operationId
      ) {
        if (
          !previousJobsCancelled
          && benchOperationIdRef.current === operationId
        ) {
          setStatus('failed');
        }
        return;
      }

      setRunMessage({ code: 'creating-job' });
      try {
        const jobsEndpoint = getA2UIBenchJobsEndpoint();
        const response = await window.fetch(jobsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playground: {
              baseUrl: getA2UIPlaygroundBaseUrl(),
            },
            provider: providerConfigured
              ? filterProviderForEndpoint(env, jobsEndpoint)
              : {},
            settings: {
              repeats: settings.repeats,
              parallelism: settings.parallelism,
              maxRepairAttempts: settings.repairEnabled ? 2 : 0,
              repairEnabled: settings.repairEnabled,
              judgeEnabled: settings.judgeEnabled,
              renderMetricsEnabled: settings.collectLiveRenderMetrics,
            },
            groups: createBenchRequestGroups(runGroups),
            scenarios: createBenchRequestScenarios(scenarios),
          }),
        });

        const payload = await response.json().catch(
          () => ({}),
        ) as BenchJobCreated;
        if (!response.ok || payload.ok === false || !payload.jobId) {
          if (payload.error) throw new Error(payload.error);
          setStatus('failed');
          setRunMessage({
            code: 'bench-request-failed',
            status: response.status,
          });
          return;
        }

        if (
          shouldCancelCreatedBenchJob(
            operationId,
            benchOperationIdRef.current,
          )
        ) {
          activeJobIdRef.current ??= payload.jobId;
          const cancelled = await cancelBenchJobs(
            [payload.jobId],
            benchOperationIdRef.current === operationId,
          );
          if (
            !cancelled
            && benchOperationIdRef.current === operationId
          ) {
            setStatus('failed');
          }
          return;
        }

        activeJobIdRef.current = payload.jobId;
        pendingCancellationJobIdsRef.current.delete(payload.jobId);
        setRunMessage(
          payload.warnings && payload.warnings.length > 0
            ? { code: 'raw', text: payload.warnings[0] }
            : { code: 'job-queued', jobId: payload.jobId.slice(0, 8) },
        );

        const eventsUrl = new URL(
          payload.eventsUrl ?? `/a2ui/bench/jobs/${payload.jobId}/events`,
          jobsEndpoint,
        ).toString();
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const source = new EventSource(eventsUrl);
        eventSourceRef.current = source;
        const clearTerminalJob = () => {
          pendingCancellationJobIdsRef.current.delete(payload.jobId);
          if (activeJobIdRef.current === payload.jobId) {
            activeJobIdRef.current = null;
          }
        };

        const updateProgress = (
          progressPayload: BenchJobSnapshot['progress'],
        ) => {
          const completed = progressPayload?.completedRuns ?? 0;
          const total = progressPayload?.totalRuns ?? runCount;
          setProgress(total > 0 ? Math.min(100, (completed / total) * 100) : 0);
        };

        const describeRun = (value: unknown): BenchRunMessage => {
          if (!value || typeof value !== 'object') {
            return { code: 'running' };
          }
          const record = value as Record<string, unknown>;
          const groupId = typeof record.groupId === 'string'
            ? record.groupId
            : undefined;
          const scenarioId = typeof record.scenarioId === 'string'
            ? record.scenarioId
            : undefined;
          const repeatIndex = typeof record.repeatIndex === 'number'
            ? record.repeatIndex
            : undefined;
          const phase = typeof record.phase === 'string'
            ? record.phase
            : 'agent';
          return {
            code: 'run-progress',
            group: runGroups.find((group) => group.id === groupId),
            phase,
            repeatIndex: repeatIndex ?? 1,
            scenario: scenarios.find((scenario) => scenario.id === scenarioId),
          };
        };

        source.addEventListener('job', (event) => {
          const snapshot = readEventData<BenchJobSnapshot>(
            event as MessageEvent<unknown>,
          );
          if (!snapshot) return;
          updateProgress(snapshot.progress);
          if (snapshot.status === 'failed') {
            setStatus('failed');
            clearTerminalJob();
            setRunMessage(
              snapshot.error
                ? { code: 'raw', text: snapshot.error }
                : { code: 'bench-failed' },
            );
          } else if (snapshot.status === 'cancelled') {
            setStatus('cancelled');
            clearTerminalJob();
            setRunMessage({ code: 'bench-cancelled' });
          } else if (snapshot.status === 'complete') {
            clearTerminalJob();
            setProgress(100);
          }
        });

        const handleRunProgress = (event: Event) => {
          const data = readEventData<Record<string, unknown>>(
            event as MessageEvent<unknown>,
          );
          if (!data) return;
          setRunMessage(describeRun(data));
          const progressPayload = data.progress as BenchJobSnapshot['progress'];
          updateProgress(progressPayload);
        };
        source.addEventListener('run-start', handleRunProgress);
        source.addEventListener('run-phase', handleRunProgress);
        source.addEventListener('run-complete', handleRunProgress);
        source.addEventListener('run-error', handleRunProgress);

        source.addEventListener('report', (event) => {
          const nextReport = readEventData<BenchReport>(
            event as MessageEvent<unknown>,
          );
          if (!nextReport) return;
          setReport(nextReport);
          setReportPlanSignature(
            createBenchPlanSignature(runGroups, scenarios, settings, env),
          );
          setHistoryItems((current) => {
            const entry = createBenchHistoryEntry(
              nextReport,
              env,
              runGroups,
              scenarios,
              settings,
            );
            const next = upsertBenchHistoryEntry(current, entry);
            persistBenchHistory(next);
            return next;
          });
          setStatus(nextReport.status ?? 'complete');
          clearTerminalJob();
          setProgress(100);
          setRunMessage({
            code: 'bench-complete',
            failedRuns: nextReport.summary?.failedRuns,
          });
          source.close();
          if (eventSourceRef.current === source) eventSourceRef.current = null;
        });

        source.addEventListener('error', (event) => {
          const data = event instanceof MessageEvent
            ? readEventData<{ message?: string; error?: string }>(event)
            : null;
          const message = data?.message ?? data?.error;
          if (
            !message
            && source.readyState !== EVENT_SOURCE_CLOSED_READY_STATE
          ) {
            setRunMessage({ code: 'reconnecting' });
            return;
          }
          setStatus('failed');
          const normalizedMessage = message?.toLowerCase();
          if (
            normalizedMessage?.includes('not found')
            || normalizedMessage?.includes('not-found')
          ) {
            clearTerminalJob();
          }
          setRunMessage(
            message
              ? { code: 'raw', text: message }
              : { code: 'stream-disconnected' },
          );
          source.close();
          if (eventSourceRef.current === source) eventSourceRef.current = null;
        });
      } catch (error) {
        if (
          shouldCancelCreatedBenchJob(
            operationId,
            benchOperationIdRef.current,
          )
        ) {
          return;
        }
        setStatus('failed');
        setRunMessage({ code: 'raw', text: getErrorMessage(error) });
      }
    })();
  }, [
    benchRunBlockers.length,
    cancelActiveBenchJob,
    cancelBenchJobs,
    env,
    loadBenchHealth,
    providerConfigured,
    runCount,
    runGroups,
    scenarios,
    settings,
  ]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    const copied = await copyToClipboard(
      serializeBenchReport(report, [env.apiKey]),
    );
    if (!copied) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1200);
  }, [env.apiKey, report]);

  const copyHistoryRecoveryUrl = useCallback(
    async (entry: BenchHistoryEntry) => {
      const jobId = entry.report.jobId;
      if (!jobId) return;
      const copied = await copyToClipboard(getA2UIBenchRecoveryUrl(jobId));
      if (!copied) return;
      setHistoryCopyId(entry.id);
      window.setTimeout(() => {
        setHistoryCopyId((current) => current === entry.id ? null : current);
      }, 1200);
    },
    [],
  );

  const restoreHistoryEntry = useCallback((entry: BenchHistoryEntry) => {
    void cancelActiveBenchJob();
    const restoredEnv = {
      ...env,
      model: entry.config.env.model,
    };
    const restoredSignature = createBenchPlanSignature(
      entry.config.groups,
      entry.config.scenarios,
      entry.config.settings,
      restoredEnv,
    );
    setEnv(restoredEnv);
    setGroups(
      restoreBenchGroupSystemNames(cloneBenchGroups(entry.config.groups)),
    );
    setScenarios(
      restoreBenchScenarioSystemTexts(
        cloneBenchScenarios(entry.config.scenarios),
      ),
    );
    setSettings(cloneBenchSettings(entry.config.settings));
    setReport(entry.report);
    setReportPlanSignature(restoredSignature);
    setStatus(entry.report.status ?? 'complete');
    setProgress(100);
    setRunMessage({
      code: 'history-report-loaded',
      failedRuns: entry.report.summary?.failedRuns,
    });
    setHistoryOpen(false);
    const jobId = entry.report.jobId;
    if (!jobId) return;

    setRunMessage({ code: 'setup-restored-loading-report' });
    const controller = new AbortController();
    historyReportAbortRef.current = controller;
    void (async () => {
      try {
        const response = await window.fetch(
          getA2UIBenchReportEndpoint(jobId),
          { signal: controller.signal },
        );
        const payload = await response.json().catch(() => ({})) as
          | BenchReport
          | { error?: string };
        if (!response.ok || !('results' in payload)) {
          throw new Error('complete report unavailable');
        }
        if (
          !shouldApplyBenchReportRequest(
            controller,
            historyReportAbortRef.current,
          )
        ) {
          return;
        }
        setReport(payload);
        setReportPlanSignature(restoredSignature);
        setStatus(payload.status ?? 'complete');
        setRunMessage({ code: 'complete-report-loaded' });
      } catch {
        if (
          !shouldApplyBenchReportRequest(
            controller,
            historyReportAbortRef.current,
          )
        ) {
          return;
        }
        setRunMessage({ code: 'setup-restored-report-unavailable' });
      } finally {
        if (historyReportAbortRef.current === controller) {
          historyReportAbortRef.current = null;
        }
      }
    })();
  }, [cancelActiveBenchJob, env]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistoryItems((current) => {
      const next = current.filter((entry) => entry.id !== id);
      persistBenchHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryItems([]);
    persistBenchHistory([]);
  }, []);

  const setWidthFromPointer = useCallback((clientX: number) => {
    const body = benchBodyRef.current;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const nextWidth = rect.right - clientX - RESIZE_HANDLE_WIDTH / 2;
    setReportPaneWidth(clampReportPaneWidth(nextWidth, rect.width));
  }, []);

  const startReportResize = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.focus();
    setWidthFromPointer(event.clientX);
    setIsResizingReport(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      setWidthFromPointer(moveEvent.clientX);
    };
    const stopResize = () => {
      setIsResizingReport(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, [setWidthFromPointer]);

  const nudgeReportWidth = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const containerWidth = benchBodyRef.current?.getBoundingClientRect().width;
    const direction = event.key === 'ArrowLeft' ? 1 : -1;
    setReportPaneWidth((current) =>
      clampReportPaneWidth(current + direction * 24, containerWidth)
    );
  }, []);

  const startScreenshotDialogResize = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.focus();
    const rect = screenshotDialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startWidth = rect.width;
    setIsResizingScreenshotDialog(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      setScreenshotDialogWidth(
        clampScreenshotDialogWidth(startWidth + moveEvent.clientX - startX),
      );
    };
    const stopResize = () => {
      setIsResizingScreenshotDialog(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, []);

  const nudgeScreenshotDialogWidth = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    setScreenshotDialogWidth((current) =>
      clampScreenshotDialogWidth(current + direction * 32)
    );
  }, []);

  const benchBodyStyle = {
    '--bench-report-width': `${reportPaneWidth}px`,
  } as CSSProperties;

  const screenshotDialogStyle = {
    '--bench-screenshot-dialog-width': `${screenshotDialogWidth}px`,
  } as CSSProperties;

  const summaryBaselines = useMemo(() => {
    const baselines = new Map<string, BenchGroupSummary>();
    if (!report) return baselines;

    const reportGroups = createBenchGroupsFromReport(report);
    for (const summary of report.summaries) {
      const group = reportGroups.find((item) => item.id === summary.groupId);
      const baselineGroup = group
        ? findComparableBaseline(group, reportGroups)
        : undefined;
      const baselineSummary = report.summaries.find((item) =>
        item.groupId === baselineGroup?.id
      ) ?? report.summaries.find((item) => item.role === 'control')
        ?? summary;
      baselines.set(summary.groupId, baselineSummary);
    }
    return baselines;
  }, [report]);

  const bestTokens = useMemo(() => {
    if (!report) return null;
    return [...report.summaries].sort((a, b) => a.avgTokens - b.avgTokens)[0]
      ?? null;
  }, [report]);

  const fastestAgent = useMemo(() => {
    if (!report) return null;
    return [...report.summaries].sort((a, b) => a.avgAgentMs - b.avgAgentMs)[0]
      ?? null;
  }, [report]);

  const topJudge = useMemo(() => {
    if (!report || report.capabilities?.judge === 'disabled') return null;
    return report.summaries.filter((item) =>
      item.judgeRunCount === undefined || item.judgeRunCount > 0
    ).sort(
      (a, b) => b.avgJudgeScore - a.avgJudgeScore,
    )[0] ?? null;
  }, [report]);
  const screenshotMatrix = useMemo(
    () => createBenchScreenshotMatrix(report),
    [report],
  );
  const screenshotMatrixStyle = {
    '--bench-screenshot-scenario-count': Math.max(
      1,
      screenshotMatrix.scenarios.length,
    ),
  } as CSSProperties;
  const reportGroupsById = new Map(
    report
      ? createBenchGroupsFromReport(report).map((group) => [group.id, group])
      : [],
  );
  const getReportGroupDisplayName = (summary: BenchGroupSummary | null) => {
    if (!summary) return 'n/a';
    const group = reportGroupsById.get(summary.groupId);
    return group
      ? getBenchGroupDisplayName(group, locale)
      : summary.groupName;
  };

  return (
    <div className='benchPage'>
      {showHeader
        ? (
          <PageHeader
            className='benchHeader'
            title='Bench Runner'
            description={benchText(
              locale,
              '自由组合 Protocol、Model、Prompt 与 Catalog，并在同一份 Report 中查看结果。',
              'Combine Protocol, Model, Prompt, and Catalog freely, then review the results in one report.',
            )}
            topContent={
              <>
                <span className='chip'>
                  {benchText(
                    locale,
                    `${activeGroups.length} 个对比组`,
                    `${activeGroups.length} comparison groups`,
                  )}
                </span>
                <span className='chip'>
                  {benchText(
                    locale,
                    `${scenarios.length} 个场景`,
                    `${scenarios.length} scenarios`,
                  )}
                </span>
                <span className='chip'>{runCount} Runs</span>
              </>
            }
          />
        )
        : (
          <h2 className='benchPageAccessibleTitle'>
            {benchText(locale, '通用 Bench Runner', 'Universal Bench Runner')}
          </h2>
        )}

      <div
        className='benchBody'
        data-report-resizing={isResizingReport}
        ref={benchBodyRef}
        style={benchBodyStyle}
      >
        <main
          className='benchMain'
          aria-label={benchText(locale, 'Bench 工作区', 'Bench workspace')}
        >
          <section className='benchOverviewBand'>
            <div className='benchRunPanel'>
              <div className='benchRunActions'>
                <Button
                  variant='primary'
                  size='lg'
                  iconBefore={Play}
                  disabled={status === 'running'}
                  onClick={() => startBench()}
                >
                  {getRunButtonText(status, locale)}
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  iconBefore={Zap}
                  disabled={planLocked}
                  onClick={() => setConfigOpen(true)}
                >
                  {benchText(locale, '运行设置', 'Run settings')}
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  iconOnly
                  iconBefore={RotateCcw}
                  aria-label={planLocked
                    ? benchText(
                      locale,
                      '停止并重置 Bench',
                      'Stop and reset Bench',
                    )
                    : benchText(locale, '重置 Bench', 'Reset Bench')}
                  title={planLocked
                    ? benchText(
                      locale,
                      '停止并重置 Bench',
                      'Stop and reset Bench',
                    )
                    : benchText(locale, '重置 Bench', 'Reset Bench')}
                  onClick={resetBench}
                />
              </div>
              <div
                className='benchProgressTrack'
                role='progressbar'
                aria-label={benchText(
                  locale,
                  'Bench 进度',
                  'Bench progress',
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  getProgressWidth(status, progress, report),
                )}
              >
                <div
                  className='benchProgressBar'
                  style={{
                    width: `${getProgressWidth(status, progress, report)}%`,
                  }}
                />
              </div>
              <div
                className='benchRunMeta'
                data-tone={status === 'failed' ? 'error' : status}
                role='status'
                aria-live='polite'
              >
                {getRunMetaText(
                  status,
                  progress,
                  runMessage,
                  runCount,
                  locale,
                )}
              </div>
            </div>
            <div className='benchPlanSummary'>
              <div className='benchPlanItem'>
                <span>Protocol</span>
                <strong>
                  {activeProtocols.map((protocol) =>
                    protocol === 'a2ui' ? 'A2UI' : 'OpenUI'
                  ).join(' + ')
                    || benchText(locale, '未选择', 'Not selected')}
                </strong>
                <small>
                  {benchText(
                    locale,
                    `${activeGroups.length} 个对比组`,
                    `${activeGroups.length} comparison groups`,
                  )}
                </small>
              </div>
              <div className='benchPlanItem'>
                <span>{benchText(locale, '运行参数', 'Run parameters')}</span>
                <strong>
                  {benchText(
                    locale,
                    `重复 ${settings.repeats} 次 / 并发 ${settings.parallelism}`,
                    `${settings.repeats} repeats / ${settings.parallelism} concurrent`,
                  )}
                </strong>
                <small>
                  UI Judge {settings.judgeEnabled
                    ? benchText(locale, '开启', 'on')
                    : benchText(locale, '关闭', 'off')} · Repair{' '}
                  {settings.repairEnabled
                    ? benchText(locale, '开启', 'on')
                    : benchText(locale, '关闭', 'off')}
                </small>
              </div>
              <div className='benchPlanItem'>
                <span>{benchText(locale, '场景', 'Scenarios')}</span>
                <strong>
                  {benchText(
                    locale,
                    `${scenarios.length} 个 Prompt`,
                    `${scenarios.length} prompts`,
                  )}
                </strong>
                <small>{activeScenarioTypes.join(' / ')}</small>
              </div>
            </div>
          </section>

          <section
            className='benchGroupsSection'
            aria-busy={planLocked}
            inert={planLocked}
          >
            <div className='benchSectionHeader benchGroupsHeader'>
              <div>
                <h3 className='benchSectionTitle'>
                  {benchText(locale, '对比组', 'Comparison groups')}
                </h3>
                <p className='benchSectionSub'>
                  {benchText(
                    locale,
                    '每个组都是一条可组合的运行条件',
                    'Each group is a composable run condition',
                  )}
                </p>
              </div>
              <div className='benchHeaderActions'>
                <details className='benchTemplateMenu'>
                  <summary>
                    {benchText(locale, '载入预设', 'Load preset')}
                  </summary>
                  <div>
                    <button
                      type='button'
                      onClick={(event) => {
                        loadGroupPreset('a2ui-variants');
                        event.currentTarget.closest('details')?.removeAttribute(
                          'open',
                        );
                      }}
                    >
                      {benchText(
                        locale,
                        'A2UI 变量对比',
                        'A2UI variable comparison',
                      )}
                      <small>Model / Prompt / Catalog</small>
                    </button>
                    <button
                      type='button'
                      onClick={(event) => {
                        loadGroupPreset('protocol-pair');
                        event.currentTarget.closest('details')?.removeAttribute(
                          'open',
                        );
                      }}
                    >
                      {benchText(
                        locale,
                        'Protocol 对照',
                        'Protocol comparison',
                      )}
                      <small>A2UI ↔ OpenUI · matched-core</small>
                    </button>
                    <button
                      type='button'
                      onClick={(event) => {
                        loadGroupPreset('combined');
                        event.currentTarget.closest('details')?.removeAttribute(
                          'open',
                        );
                      }}
                    >
                      {benchText(locale, '组合示例', 'Combined example')}
                      <small>
                        {benchText(
                          locale,
                          '把两类条件放进同一张 plan',
                          'Put both condition types in one plan',
                        )}
                      </small>
                    </button>
                    <button
                      type='button'
                      onClick={(event) => {
                        loadGroupPreset('blank');
                        event.currentTarget.closest('details')?.removeAttribute(
                          'open',
                        );
                      }}
                    >
                      {benchText(locale, '空白 plan', 'Blank plan')}
                      <small>
                        {benchText(
                          locale,
                          '从一个 Baseline 开始',
                          'Start from one baseline',
                        )}
                      </small>
                    </button>
                  </div>
                </details>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={MessageSquarePlus}
                  onClick={() => addGroup('experiment')}
                >
                  {benchText(
                    locale,
                    '添加对比组',
                    'Add comparison group',
                  )}
                </Button>
              </div>
            </div>

            <div className='benchGroupGrid'>
              {groups.map((group) => (
                <article
                  className='benchGroupCard'
                  data-disabled={!group.enabled}
                  key={group.id}
                >
                  <div className='benchGroupTop'>
                    <label className='benchSwitch'>
                      <input
                        type='checkbox'
                        checked={group.enabled}
                        aria-label={benchText(
                          locale,
                          `启用 ${getBenchGroupDisplayName(group, locale)}`,
                          `Enable ${getBenchGroupDisplayName(group, locale)}`,
                        )}
                        onChange={(event) =>
                          updateGroup(
                            group.id,
                            groupPatch('enabled', event.target.checked),
                          )}
                      />
                      <span />
                    </label>
                    <div className='benchRoleControl'>
                      {(['control', 'experiment'] as const).map((role) => (
                        <button
                          type='button'
                          className={group.role === role
                            ? 'benchRoleButton active'
                            : 'benchRoleButton'}
                          aria-pressed={group.role === role}
                          disabled={role === 'experiment'
                            && group.role === 'control'
                            && configuredControlGroupCount === 1}
                          key={role}
                          onClick={() =>
                            updateGroup(group.id, groupPatch('role', role))}
                        >
                          {role === 'control'
                            ? benchText(locale, '基准', 'Baseline')
                            : benchText(locale, '对比', 'Comparison')}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant='danger'
                      size='sm'
                      iconOnly
                      iconBefore={Trash2}
                      aria-label={benchText(
                        locale,
                        `删除 ${getBenchGroupDisplayName(group, locale)}`,
                        `Delete ${getBenchGroupDisplayName(group, locale)}`,
                      )}
                      title={benchText(
                        locale,
                        `删除 ${getBenchGroupDisplayName(group, locale)}`,
                        `Delete ${getBenchGroupDisplayName(group, locale)}`,
                      )}
                      disabled={groups.length <= 1}
                      onClick={() => removeGroup(group.id)}
                    />
                  </div>
                  <input
                    className='benchGroupName'
                    value={getBenchGroupDisplayName(group, locale)}
                    aria-label={benchText(
                      locale,
                      '对比组名称',
                      'Comparison group name',
                    )}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        name: event.target.value,
                        systemName: undefined,
                      })}
                  />
                  <div className='benchGroupSummary'>
                    <span data-protocol={group.protocol}>
                      {group.protocol === 'a2ui' ? 'A2UI' : 'OpenUI'}
                    </span>
                    <span>{group.profile}</span>
                    <span>{group.model || env.model}</span>
                    {(groupDifferences.get(group.id) ?? []).length === 0
                      ? (
                        <span data-baseline='true'>
                          {benchText(locale, '基准', 'Baseline')}
                        </span>
                      )
                      : (groupDifferences.get(group.id) ?? []).map(
                        (difference) => (
                          <span data-changed='true' key={difference}>
                            {benchText(
                              locale,
                              `${difference} 已变更`,
                              `${difference} changed`,
                            )}
                          </span>
                        ),
                      )}
                    {group.role === 'experiment'
                        && groupBaselines.get(group.id)
                      ? (
                        <span data-baseline='true'>
                          {benchText(
                            locale,
                            `相对 ${
                              getBenchGroupDisplayName(
                                groupBaselines.get(group.id)!,
                                locale,
                              )
                            }`,
                            `vs. ${
                              getBenchGroupDisplayName(
                                groupBaselines.get(group.id)!,
                                locale,
                              )
                            }`,
                          )}
                        </span>
                      )
                      : null}
                  </div>
                  <details className='benchGroupDetails'>
                    <summary>{benchText(locale, '配置', 'Configure')}</summary>
                    <div className='benchGroupFields'>
                      <div className='benchField'>
                        <span className='benchFieldLabel'>Protocol</span>
                        <BenchDropdown
                          ariaLabel={`${
                            getBenchGroupDisplayName(group, locale)
                          } Protocol`}
                          value={group.protocol}
                          options={[
                            {
                              value: 'a2ui',
                              label: 'A2UI',
                              description: benchText(
                                locale,
                                '结构化消息流',
                                'Structured message stream',
                              ),
                            },
                            {
                              value: 'openui',
                              label: 'OpenUI',
                              description: 'OpenUI Lang',
                            },
                          ]}
                          onChange={(protocol) =>
                            updateGroupProtocol(group.id, protocol)}
                        />
                      </div>
                      <div className='benchField'>
                        <span className='benchFieldLabel'>Profile</span>
                        <BenchDropdown
                          ariaLabel={`${
                            getBenchGroupDisplayName(group, locale)
                          } Profile`}
                          value={group.profile}
                          disabled={group.protocol === 'openui'}
                          options={[
                            {
                              value: 'native',
                              label: 'native',
                              description: benchText(
                                locale,
                                '使用完整协议能力',
                                'Use the full protocol capability set',
                              ),
                            },
                            {
                              value: 'matched-core',
                              label: 'matched-core',
                              description: benchText(
                                locale,
                                '只使用公共能力子集',
                                'Use only the shared capability subset',
                              ),
                            },
                          ]}
                          onChange={(profile) =>
                            updateGroupProfile(group.id, profile)}
                        />
                      </div>
                    </div>
                    {group.profile === 'matched-core'
                      ? (
                        <p className='benchProfileHint'>
                          <strong>matched-core</strong> {benchText(
                            locale,
                            '只使用 A2UI 与 OpenUI 都支持的公共能力，适合做同条件 Protocol 对照。',
                            'uses only capabilities shared by A2UI and OpenUI, making it suitable for a like-for-like Protocol comparison.',
                          )}
                        </p>
                      )
                      : null}
                    <div className='benchGroupFields'>
                      <label className='benchField'>
                        <span className='benchFieldLabel'>Model</span>
                        <input
                          className='benchInput'
                          type='text'
                          value={group.model}
                          placeholder={env.model}
                          onChange={(event) =>
                            updateGroup(
                              group.id,
                              groupPatch('model', event.target.value),
                            )}
                        />
                      </label>
                      <div className='benchField'>
                        <span className='benchFieldLabel'>Catalog</span>
                        <BenchDropdown
                          ariaLabel={`${
                            getBenchGroupDisplayName(group, locale)
                          } Catalog`}
                          value={group.catalog}
                          disabled={group.profile === 'matched-core'
                            || group.protocol === 'openui'}
                          options={CATALOG_OPTIONS.map((catalog) => ({
                            value: catalog,
                            label: catalog,
                          }))}
                          onChange={(catalog) =>
                            updateGroup(
                              group.id,
                              groupPatch('catalog', catalog),
                            )}
                        />
                      </div>
                    </div>
                    <label className='benchField'>
                      <span className='benchFieldLabel'>
                        {benchText(
                          locale,
                          'Prompt 附加指令',
                          'Additional prompt instructions',
                        )}
                      </span>
                      <textarea
                        className='benchTextarea'
                        value={group.extraInstruction}
                        placeholder={benchText(
                          locale,
                          '只对这个对比组追加的 Prompt',
                          'Prompt appended only to this comparison group',
                        )}
                        onChange={(event) =>
                          updateGroup(
                            group.id,
                            groupPatch('extraInstruction', event.target.value),
                          )}
                      />
                    </label>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section
            className='benchPlanSection'
            aria-busy={planLocked}
            inert={planLocked}
          >
            <div className='benchSectionHeader'>
              <div>
                <h3 className='benchSectionTitle'>
                  {benchText(locale, '共享场景', 'Shared scenarios')}
                </h3>
                <p className='benchSectionSub'>
                  {benchText(
                    locale,
                    `${activeGroups.length} 个对比组 × ${scenarios.length} 个场景 × 重复 ${settings.repeats} 次 = ${runCount} Runs`,
                    `${activeGroups.length} comparison groups × ${scenarios.length} scenarios × ${settings.repeats} repeats = ${runCount} runs`,
                  )}
                </p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                iconBefore={Zap}
                disabled={planLocked}
                onClick={() => setConfigOpen(true)}
              >
                {benchText(locale, '编辑场景', 'Edit scenarios')}
              </Button>
            </div>
            <div className='benchScenarioChips'>
              {scenarios.map((scenario) => (
                <span className='benchScenarioChip' key={scenario.id}>
                  {getBenchScenarioDisplayName(scenario, locale)}
                </span>
              ))}
            </div>
          </section>
        </main>

        <div
          className='benchResizeHandle'
          role='separator'
          aria-label={benchText(
            locale,
            '调整 Report 面板宽度',
            'Resize report panel',
          )}
          aria-orientation='vertical'
          aria-valuemin={REPORT_PANE_MIN_WIDTH}
          aria-valuemax={REPORT_PANE_MAX_WIDTH}
          aria-valuenow={reportPaneWidth}
          tabIndex={0}
          onKeyDown={nudgeReportWidth}
          onPointerDown={startReportResize}
        >
          <span aria-hidden='true' />
        </div>

        <aside className='benchReportPane' aria-label='Bench Report'>
          <div className='benchReportHeader'>
            <div>
              <h3 className='benchSectionTitle'>Report</h3>
              <p
                className='benchSectionSub'
                data-stale={reportIsStale || undefined}
              >
                {getReportSubtitle(report, reportIsStale, locale)}
              </p>
            </div>
            <div className='benchReportActions'>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={History}
                onClick={() => setHistoryOpen(true)}
              >
                {benchText(locale, '历史', 'History')}
              </Button>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={Copy}
                disabled={!report}
                onClick={() => void copyReport()}
              >
                {copyState === 'copied'
                  ? benchText(locale, '已复制', 'Copied')
                  : 'JSON'}
              </Button>
            </div>
          </div>

          {report && report.summaries.length > 0
            ? (
              <>
                <div className='benchInsightGrid'>
                  <div className='benchInsight'>
                    <span>
                      {benchText(locale, 'Token 最低', 'Lowest tokens')}
                    </span>
                    <strong>{getReportGroupDisplayName(bestTokens)}</strong>
                    <small>
                      {bestTokens
                        ? formatNumber(bestTokens.avgTokens)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>
                      {benchText(locale, 'Agent 最快', 'Fastest agent')}
                    </span>
                    <strong>{getReportGroupDisplayName(fastestAgent)}</strong>
                    <small>
                      {fastestAgent
                        ? formatMs(fastestAgent.avgAgentMs)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>
                      {benchText(locale, 'Judge 最佳', 'Best judge score')}
                    </span>
                    <strong>{getReportGroupDisplayName(topJudge)}</strong>
                    <small>
                      {topJudge
                        ? `${topJudge.avgJudgeScore.toFixed(1)}/5`
                        : 'n/a'}
                    </small>
                  </div>
                </div>

                <div className='benchReportTableWrap'>
                  <table className='benchReportTable'>
                    <thead>
                      <tr>
                        <th>
                          {benchText(
                            locale,
                            '对比组',
                            'Comparison group',
                          )}
                        </th>
                        <th>Tokens</th>
                        <th>Agent</th>
                        <th>FMP</th>
                        <th>TTI</th>
                        <th>Render</th>
                        <th>Attempts</th>
                        <th>Judge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.summaries.map((summary) => {
                        const summaryBaseline = summaryBaselines.get(
                          summary.groupId,
                        ) ?? summary;
                        return (
                          <tr key={summary.groupId}>
                            <td>
                              <div className='benchTableGroup'>
                                <span
                                  className={`benchRoleDot ${summary.role}`}
                                />
                                <span>
                                  {getReportGroupDisplayName(summary)}
                                  <small>
                                    {summary.protocol === 'openui'
                                      ? 'OpenUI'
                                      : 'A2UI'}
                                    {summary.profile
                                      ? ` · ${summary.profile}`
                                      : ''}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>
                              <strong>{formatNumber(summary.avgTokens)}</strong>
                              <small>
                                {deltaText(
                                  summary.avgTokens,
                                  summaryBaseline.avgTokens,
                                )}
                              </small>
                            </td>
                            <td>
                              <strong>{formatMs(summary.avgAgentMs)}</strong>
                              <small>
                                {deltaText(
                                  summary.avgAgentMs,
                                  summaryBaseline.avgAgentMs,
                                )}
                              </small>
                            </td>
                            <td>{formatMs(summary.avgFmpMs)}</td>
                            <td>{formatMs(summary.avgTtiMs)}</td>
                            <td>{formatMs(summary.avgRenderMs)}</td>
                            <td>{summary.avgAttempts.toFixed(1)}x</td>
                            <td>
                              {formatSummaryJudgeMetric(
                                report,
                                reportSettings,
                                summary,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <section className='benchScreenshotSection'>
                  <div className='benchSectionHeader'>
                    <div>
                      <h3 className='benchSectionTitle'>
                        {benchText(locale, '运行截图', 'Run screenshots')}
                      </h3>
                      <p className='benchSectionSub'>
                        {benchText(
                          locale,
                          '每个 run 的实际渲染截图，失败位置也会保留',
                          'Actual render screenshots for every run, including failed slots',
                        )}
                      </p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={Maximize2}
                      disabled={screenshotMatrix.total === 0}
                      onClick={() => setScreenshotsOpen(true)}
                    >
                      {benchText(locale, '查看截图', 'View screenshots')}
                    </Button>
                  </div>
                  <div className='benchScreenshotSummaryGrid'>
                    <div>
                      <span>Runs</span>
                      <strong>{formatNumber(screenshotMatrix.total)}</strong>
                    </div>
                    <div>
                      <span>{benchText(locale, '已截图', 'Captured')}</span>
                      <strong>
                        {formatNumber(screenshotMatrix.captured)}
                      </strong>
                    </div>
                    <div>
                      <span>{benchText(locale, '失败', 'Failed')}</span>
                      <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                    </div>
                    <div>
                      <span>{benchText(locale, '缺失', 'Missing')}</span>
                      <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                    </div>
                  </div>
                </section>

                <div className='benchReportNotes'>
                  <span>
                    {benchText(
                      locale,
                      'Agent、Token、Attempts 与校验数据由服务端采集；Render 或 UI Judge 不可用时会明确标记。',
                      'Agent, token, attempts, and validation data are collected by the server. Unavailable Render or UI Judge data is explicitly marked.',
                    )}
                  </span>
                </div>
                {report.warnings && report.warnings.length > 0
                  ? (
                    <div className='benchReportWarnings'>
                      {report.warnings.map((warning) => (
                        <span key={warning}>{warning}</span>
                      ))}
                    </div>
                  )
                  : null}
              </>
            )
            : (
              <div className='benchEmptyReport'>
                <Sparkles size={28} strokeWidth={1.8} />
                <strong>
                  {benchText(
                    locale,
                    '等待 Bench 数据',
                    'Waiting for Bench data',
                  )}
                </strong>
                <span>
                  {benchText(
                    locale,
                    '运行当前计划后，这里会生成统一 Report。',
                    'Run the current plan to generate a unified report here.',
                  )}
                </span>
              </div>
            )}
        </aside>
      </div>

      {screenshotsOpen && report
        ? (
          <div
            className='benchConfigOverlay'
            role='presentation'
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setScreenshotsOpen(false);
              }
            }}
          >
            <section
              ref={screenshotDialogRef}
              className='benchConfigDialog benchScreenshotDialog'
              data-resizing={isResizingScreenshotDialog}
              role='dialog'
              aria-modal='true'
              aria-labelledby='bench-screenshots-title'
              style={screenshotDialogStyle}
            >
              <header className='benchConfigHeader'>
                <div>
                  <h2
                    id='bench-screenshots-title'
                    className='benchConfigTitle'
                  >
                    {benchText(locale, '运行截图', 'Run screenshots')}
                  </h2>
                  <p className='benchConfigSub'>
                    {benchText(
                      locale,
                      `${screenshotMatrix.rows.length} 个对比组 × ${screenshotMatrix.scenarios.length} 个场景 · 重复 ${screenshotMatrix.repeatCount} 次`,
                      `${screenshotMatrix.rows.length} comparison groups × ${screenshotMatrix.scenarios.length} scenarios · ${screenshotMatrix.repeatCount} repeats`,
                    )}
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label={benchText(
                    locale,
                    '关闭截图',
                    'Close screenshots',
                  )}
                  title={benchText(
                    locale,
                    '关闭截图',
                    'Close screenshots',
                  )}
                  onClick={() => setScreenshotsOpen(false)}
                />
              </header>

              <div className='benchScreenshotBody'>
                <div className='benchScreenshotSummaryGrid'>
                  <div>
                    <span>Runs</span>
                    <strong>{formatNumber(screenshotMatrix.total)}</strong>
                  </div>
                  <div>
                    <span>{benchText(locale, '已截图', 'Captured')}</span>
                    <strong>{formatNumber(screenshotMatrix.captured)}</strong>
                  </div>
                  <div>
                    <span>{benchText(locale, '失败', 'Failed')}</span>
                    <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                  </div>
                  <div>
                    <span>{benchText(locale, '缺失', 'Missing')}</span>
                    <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                  </div>
                </div>

                <div className='benchScreenshotMatrixWrap'>
                  <div
                    className='benchScreenshotMatrix'
                    style={screenshotMatrixStyle}
                  >
                    <div className='benchScreenshotMatrixCorner'>
                      {benchText(
                        locale,
                        '对比组',
                        'Comparison group',
                      )}
                    </div>
                    {screenshotMatrix.scenarios.map((scenario) => (
                      <div
                        className='benchScreenshotScenarioHeader'
                        key={scenario.id}
                      >
                        <strong>
                          {getBenchScenarioDisplayName(scenario, locale)}
                        </strong>
                        <span>
                          {getBenchScenarioFieldText(
                            scenario.type,
                            scenario.systemType,
                            locale,
                          )}
                        </span>
                      </div>
                    ))}
                    {screenshotMatrix.rows.map((row) => (
                      <div className='benchScreenshotMatrixRow' key={row.key}>
                        <div className='benchScreenshotGroupHeader'>
                          <span
                            className={`benchRoleDot ${row.group.role}`}
                            aria-hidden='true'
                          />
                          <div>
                            <strong>
                              {getBenchGroupDisplayName(row.group, locale)}
                            </strong>
                            <span>
                              {row.group.protocol === 'openui'
                                ? 'OpenUI'
                                : 'A2UI'}
                              {' · '}
                              {row.group.profile}
                            </span>
                          </div>
                        </div>
                        {row.cells.map((cell) => (
                          <div
                            className='benchScreenshotMatrixCell'
                            key={cell.key}
                          >
                            {cell.slots.map((slot) => {
                              const item = slot.result;
                              return (
                                <article
                                  className='benchScreenshotSlot'
                                  data-state={slot.state}
                                  key={slot.key}
                                >
                                  <div className='benchScreenshotSlotHeader'>
                                    <strong>#{slot.repeatIndex}</strong>
                                    <span
                                      className='benchScreenshotState'
                                      data-state={slot.state}
                                    >
                                      {getScreenshotStateLabelFromState(
                                        slot.state,
                                        locale,
                                      )}
                                    </span>
                                  </div>
                                  {item?.screenshotDataUrl
                                    ? (
                                      <div className='benchScreenshotImageFrame'>
                                        <img
                                          alt={`${
                                            getBenchGroupDisplayName(
                                              cell.group,
                                              locale,
                                            )
                                          } ${
                                            getBenchScenarioDisplayName(
                                              cell.scenario,
                                              locale,
                                            )
                                          } #${slot.repeatIndex}`}
                                          src={item.screenshotDataUrl}
                                        />
                                      </div>
                                    )
                                    : (
                                      <div className='benchScreenshotPlaceholder'>
                                        <strong>
                                          {getScreenshotStateLabelFromState(
                                            slot.state,
                                            locale,
                                          )}
                                        </strong>
                                        <span>
                                          {getScreenshotPlaceholderText(
                                            item,
                                            locale,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  <div className='benchScreenshotSlotMeta'>
                                    {item
                                      ? (
                                        <>
                                          <span>
                                            Judge {formatRunJudgeMetric(
                                              report,
                                              reportSettings,
                                              item,
                                            )}
                                          </span>
                                          <span>{formatMs(item.agentMs)}</span>
                                          <span>
                                            {formatNumber(item.tokens)} tokens
                                          </span>
                                        </>
                                      )
                                      : (
                                        <span>
                                          {benchText(
                                            locale,
                                            '无结果',
                                            'No result',
                                          )}
                                        </span>
                                      )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <footer className='benchConfigFooter'>
                <Button
                  variant='primary'
                  size='sm'
                  onClick={() => setScreenshotsOpen(false)}
                >
                  {benchText(locale, '完成', 'Done')}
                </Button>
              </footer>
              <div
                className='benchScreenshotResizeHandle'
                role='separator'
                aria-label={benchText(
                  locale,
                  '调整截图弹窗宽度',
                  'Resize screenshot dialog',
                )}
                aria-orientation='vertical'
                aria-valuemin={SCREENSHOT_DIALOG_MIN_WIDTH}
                aria-valuemax={SCREENSHOT_DIALOG_MAX_WIDTH}
                aria-valuenow={screenshotDialogWidth}
                tabIndex={0}
                onKeyDown={nudgeScreenshotDialogWidth}
                onPointerDown={startScreenshotDialogResize}
              >
                <span aria-hidden='true' />
              </div>
            </section>
          </div>
        )
        : null}

      {historyOpen
        ? (
          <div
            className='benchConfigOverlay'
            role='presentation'
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setHistoryOpen(false);
            }}
          >
            <section
              className='benchConfigDialog benchHistoryDialog'
              role='dialog'
              aria-modal='true'
              aria-labelledby='bench-history-title'
            >
              <header className='benchConfigHeader'>
                <div>
                  <h2 id='bench-history-title' className='benchConfigTitle'>
                    {benchText(locale, 'Bench 历史', 'Bench history')}
                  </h2>
                  <p className='benchConfigSub'>
                    {historyItems.length > 0
                      ? benchText(
                        locale,
                        `已保存 ${historyItems.length} 次运行`,
                        `${historyItems.length} saved runs`,
                      )
                      : benchText(
                        locale,
                        '还没有保存的运行',
                        'No saved runs yet',
                      )}
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label={benchText(
                    locale,
                    '关闭 Bench 历史',
                    'Close Bench history',
                  )}
                  title={benchText(
                    locale,
                    '关闭 Bench 历史',
                    'Close Bench history',
                  )}
                  onClick={() => setHistoryOpen(false)}
                />
              </header>

              <div className='benchHistoryBody'>
                {historyItems.length > 0
                  ? (
                    <div className='benchHistoryList'>
                      {historyItems.map((entry) => {
                        const summary = entry.report.summary;
                        const failedRuns = summary?.failedRuns ?? 0;
                        const totalRuns = summary?.totalRuns
                          ?? entry.report.results.length;
                        const jobId = entry.report.jobId;
                        const recoveryUrl = jobId
                          ? getA2UIBenchRecoveryUrl(jobId)
                          : null;
                        return (
                          <article className='benchHistoryCard' key={entry.id}>
                            <div className='benchHistoryCardHeader'>
                              <div>
                                <h3>{entry.title}</h3>
                                <p>
                                  {new Date(entry.savedAt).toLocaleString(
                                    locale === 'en-US' ? 'en-US' : 'zh-CN',
                                  )}
                                </p>
                              </div>
                              <span
                                className='benchHistoryStatus'
                                data-tone={failedRuns > 0 ? 'warn' : 'ok'}
                              >
                                {failedRuns > 0
                                  ? benchText(
                                    locale,
                                    `${failedRuns} 个失败 Run`,
                                    `${failedRuns} failed runs`,
                                  )
                                  : benchText(locale, '通过', 'Passed')}
                              </span>
                            </div>

                            <div className='benchHistoryStats'>
                              <div>
                                <span>Runs</span>
                                <strong>{formatNumber(totalRuns)}</strong>
                              </div>
                              <div>
                                <span>
                                  {benchText(locale, '成功率', 'Success rate')}
                                </span>
                                <strong>
                                  {summary
                                    ? `${
                                      Math.round(summary.successRate * 100)
                                    }%`
                                    : 'n/a'}
                                </strong>
                              </div>
                              <div>
                                <span>Agent</span>
                                <strong>
                                  {summary
                                    ? formatMs(summary.avgAgentMs)
                                    : 'n/a'}
                                </strong>
                              </div>
                              <div>
                                <span>Tokens</span>
                                <strong>
                                  {summary
                                    ? formatNumber(summary.avgTokens)
                                    : 'n/a'}
                                </strong>
                              </div>
                            </div>

                            <div className='benchHistoryConfig'>
                              <span>{entry.config.env.model}</span>
                              <span>
                                {entry.config.env.apiKeyConfigured
                                  ? benchText(
                                    locale,
                                    'API key 已配置',
                                    'API key configured',
                                  )
                                  : benchText(
                                    locale,
                                    '无 API key',
                                    'No API key',
                                  )}
                              </span>
                              <span>
                                {benchText(
                                  locale,
                                  `重复 ${entry.config.settings.repeats} 次 / 并发 ${entry.config.settings.parallelism}`,
                                  `${entry.config.settings.repeats} repeats / ${entry.config.settings.parallelism} concurrent`,
                                )}
                              </span>
                              <span>
                                {benchText(
                                  locale,
                                  `${entry.config.groups.length} 个对比组 · ${entry.config.scenarios.length} 个场景`,
                                  `${entry.config.groups.length} comparison groups · ${entry.config.scenarios.length} scenarios`,
                                )}
                              </span>
                              {jobId
                                ? <span>job {jobId.slice(0, 8)}</span>
                                : null}
                            </div>

                            <details className='benchHistoryDetails'>
                              <summary>
                                {benchText(
                                  locale,
                                  '配置快照',
                                  'Setup snapshot',
                                )}
                              </summary>
                              <div className='benchHistorySnapshot'>
                                {jobId
                                  ? (
                                    <div>
                                      <span>Bench Job ID</span>
                                      <strong>{jobId}</strong>
                                    </div>
                                  )
                                  : null}
                                {recoveryUrl
                                  ? (
                                    <div>
                                      <span>
                                        {benchText(
                                          locale,
                                          '恢复链接',
                                          'Recovery link',
                                        )}
                                      </span>
                                      <strong>{recoveryUrl}</strong>
                                    </div>
                                  )
                                  : null}
                                <div>
                                  <span>
                                    {benchText(
                                      locale,
                                      '对比组',
                                      'Comparison groups',
                                    )}
                                  </span>
                                  <strong>
                                    {entry.config.groups.map((group) =>
                                      `${
                                        getBenchGroupDisplayName(group, locale)
                                      } (${group.model})`
                                    ).join(', ')}
                                  </strong>
                                </div>
                                <div>
                                  <span>
                                    {benchText(locale, '场景', 'Scenarios')}
                                  </span>
                                  <strong>
                                    {entry.config.scenarios.map((scenario) =>
                                      getBenchScenarioDisplayName(
                                        scenario,
                                        locale,
                                      )
                                    ).join(', ')}
                                  </strong>
                                </div>
                              </div>
                            </details>

                            <div className='benchHistoryActions'>
                              <Button
                                variant='primary'
                                size='sm'
                                iconBefore={RotateCcw}
                                onClick={() => restoreHistoryEntry(entry)}
                              >
                                {benchText(locale, '恢复', 'Restore')}
                              </Button>
                              <div className='benchHistorySecondaryActions'>
                                <Button
                                  variant='secondary'
                                  size='sm'
                                  iconBefore={Copy}
                                  disabled={!jobId}
                                  onClick={() =>
                                    void copyHistoryRecoveryUrl(entry)}
                                >
                                  {historyCopyId === entry.id
                                    ? benchText(locale, '已复制', 'Copied')
                                    : benchText(
                                      locale,
                                      '复制链接',
                                      'Copy link',
                                    )}
                                </Button>
                                <Button
                                  variant='secondary'
                                  size='sm'
                                  iconBefore={Trash2}
                                  onClick={() => deleteHistoryEntry(entry.id)}
                                >
                                  {benchText(locale, '删除', 'Delete')}
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )
                  : (
                    <div className='benchEmptyReport benchHistoryEmpty'>
                      <History size={28} strokeWidth={1.8} />
                      <strong>
                        {benchText(locale, '暂无历史', 'No history yet')}
                      </strong>
                      <span>
                        {benchText(
                          locale,
                          '完成的 Bench 会自动保存在这里。',
                          'Completed Bench runs are saved here automatically.',
                        )}
                      </span>
                    </div>
                  )}
              </div>

              <footer className='benchConfigFooter'>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={Trash2}
                  disabled={historyItems.length === 0}
                  onClick={clearHistory}
                >
                  {benchText(locale, '清空历史', 'Clear history')}
                </Button>
                <Button
                  variant='primary'
                  size='sm'
                  onClick={() => setHistoryOpen(false)}
                >
                  {benchText(locale, '完成', 'Done')}
                </Button>
              </footer>
            </section>
          </div>
        )
        : null}

      {benchRunNoticeOpen
        ? (
          <div
            className='benchConfigOverlay'
            role='presentation'
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setBenchRunNoticeOpen(false);
              }
            }}
          >
            <section
              className='benchConfigDialog benchRunNoticeDialog'
              role='alertdialog'
              aria-modal='true'
              aria-labelledby='bench-run-notice-title'
              aria-describedby='bench-run-notice-desc'
            >
              <header className='benchConfigHeader benchRunNoticeHeader'>
                <div className='benchRunNoticeLead'>
                  <span className='benchRunNoticeIcon' aria-hidden='true'>
                    <Zap size={17} strokeWidth={2} />
                  </span>
                  <div>
                    <h2
                      id='bench-run-notice-title'
                      className='benchConfigTitle'
                    >
                      {benchRunBlockers.length > 0
                        ? benchText(
                          locale,
                          '还不能运行 Bench',
                          'Bench is not ready to run',
                        )
                        : benchText(
                          locale,
                          '使用服务端默认配置？',
                          'Use the server defaults?',
                        )}
                    </h2>
                    <p id='bench-run-notice-desc' className='benchConfigSub'>
                      {benchRunBlockers.length > 0
                        ? benchText(
                          locale,
                          '请先补全下面的必要配置。',
                          'Complete the required setup below first.',
                        )
                        : benchText(
                          locale,
                          '当前没有填写自定义 Provider。',
                          'No custom Provider is configured.',
                        )}
                    </p>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label={benchText(
                    locale,
                    '关闭提示',
                    'Close notice',
                  )}
                  title={benchText(locale, '关闭提示', 'Close notice')}
                  onClick={() => setBenchRunNoticeOpen(false)}
                />
              </header>

              <div className='benchRunNoticeBody'>
                {benchRunBlockers.length > 0
                  ? (
                    <ul className='benchRunNoticeList'>
                      {benchRunBlockers.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )
                  : (
                    <>
                      <p className='benchRunNoticeText'>
                        {benchText(
                          locale,
                          '本次运行将使用服务端已配置的 Provider，浏览器不会发送 Provider 密钥、地址或默认 Model。',
                          'This run will use the Provider configured on the server. The browser will not send a Provider key, address, or default Model.',
                        )}
                      </p>
                      <div className='benchRunHealthCard'>
                        <div>
                          <span>API key</span>
                          <strong>
                            {getBenchHealthKeyLabel(
                              benchHealth,
                              benchHealthError,
                              locale,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Model</span>
                          <strong>
                            {benchHealth?.modelName
                              ?? benchText(
                                locale,
                                '服务端默认',
                                'Server default',
                              )}
                          </strong>
                        </div>
                        <div>
                          <span>Image generation</span>
                          <strong>
                            {getBenchImageHealthLabel(benchHealth, locale)}
                          </strong>
                        </div>
                      </div>
                      {benchHealthError
                        ? (
                          <p className='benchRunNoticeError'>
                            {getBenchHealthErrorText(
                              benchHealthError,
                              locale,
                            )}
                          </p>
                        )
                        : null}
                    </>
                  )}
              </div>

              <footer className='benchConfigFooter'>
                <Button
                  variant='secondary'
                  size='md'
                  onClick={() => setBenchRunNoticeOpen(false)}
                >
                  {benchText(locale, '关闭', 'Close')}
                </Button>
                <Button
                  variant={benchRunBlockers.length > 0
                    ? 'primary'
                    : 'secondary'}
                  size='md'
                  iconBefore={Zap}
                  onClick={() => {
                    setBenchRunNoticeOpen(false);
                    setConfigOpen(true);
                  }}
                >
                  {benchText(locale, '去配置', 'Open settings')}
                </Button>
                {benchRunBlockers.length === 0
                  ? (
                    <Button
                      variant='primary'
                      size='md'
                      iconBefore={Play}
                      disabled={benchHealth?.ok !== true}
                      onClick={() => {
                        setBenchRunNoticeOpen(false);
                        startBench(true);
                      }}
                    >
                      {benchText(
                        locale,
                        '使用默认配置运行',
                        'Run with defaults',
                      )}
                    </Button>
                  )
                  : null}
              </footer>
            </section>
          </div>
        )
        : null}

      {configOpen
        ? (
          <div
            className='benchConfigOverlay'
            role='presentation'
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setConfigOpen(false);
            }}
          >
            <section
              className='benchConfigDialog'
              role='dialog'
              aria-modal='true'
              aria-labelledby='bench-config-title'
            >
              <header className='benchConfigHeader'>
                <div>
                  <h2 id='bench-config-title' className='benchConfigTitle'>
                    {benchText(locale, '运行设置', 'Run settings')}
                  </h2>
                  <p className='benchConfigSub'>
                    {benchText(
                      locale,
                      '配置 Provider、运行参数与场景。',
                      'Configure the Provider, run parameters, and scenarios.',
                    )}
                  </p>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label={benchText(
                    locale,
                    '关闭运行设置',
                    'Close run settings',
                  )}
                  title={benchText(
                    locale,
                    '关闭运行设置',
                    'Close run settings',
                  )}
                  onClick={() => setConfigOpen(false)}
                />
              </header>

              <div className='benchConfigBody'>
                <div className='benchConfigColumn'>
                  <section className='benchConfigSection'>
                    <div className='benchSectionHeader'>
                      <div>
                        <h3 className='benchSectionTitle'>Provider</h3>
                        <p className='benchSectionSub'>
                          OpenAI-compatible runtime
                        </p>
                      </div>
                      <span className='benchStatusPill'>
                        {env.apiKey.trim()
                          ? benchText(
                            locale,
                            'Key 已配置',
                            'Key configured',
                          )
                          : benchText(locale, '无 Key', 'No key')}
                      </span>
                    </div>
                    <label className='benchField'>
                      <span className='benchFieldLabel'>OPENAI_API_KEY</span>
                      <input
                        className='benchInput'
                        type='password'
                        value={env.apiKey}
                        placeholder='sk-...'
                        onChange={(event) =>
                          setEnv((current) => ({
                            ...current,
                            apiKey: event.target.value,
                          }))}
                      />
                    </label>
                    <label className='benchField'>
                      <span className='benchFieldLabel'>OPENAI_BASE_URL</span>
                      <input
                        className='benchInput'
                        type='text'
                        value={env.baseURL}
                        onChange={(event) =>
                          setEnv((current) => ({
                            ...current,
                            baseURL: event.target.value,
                          }))}
                      />
                    </label>
                    <label className='benchField'>
                      <span className='benchFieldLabel'>
                        {benchText(
                          locale,
                          '新建对比组的默认 Model',
                          'Default Model for new comparison groups',
                        )}
                      </span>
                      <input
                        className='benchInput'
                        type='text'
                        value={env.model}
                        onChange={(event) =>
                          setEnv((current) => ({
                            ...current,
                            model: event.target.value,
                          }))}
                      />
                    </label>
                  </section>

                  <section className='benchConfigSection'>
                    <div className='benchSectionHeader'>
                      <div>
                        <h3 className='benchSectionTitle'>
                          {benchText(locale, '运行参数', 'Run parameters')}
                        </h3>
                        <p className='benchSectionSub'>
                          {benchText(
                            locale,
                            'Repeats、并发与检查项',
                            'Repeats, concurrency, and checks',
                          )}
                        </p>
                      </div>
                      <Zap size={15} strokeWidth={2} />
                    </div>
                    <div className='benchRunnerGrid'>
                      <label className='benchField'>
                        <span className='benchFieldLabel'>Repeats</span>
                        <input
                          className='benchInput'
                          type='number'
                          min={1}
                          max={10}
                          value={settings.repeats}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              repeats: clampNumber(
                                Number(event.target.value),
                                1,
                                10,
                              ),
                            }))}
                        />
                      </label>
                      <label className='benchField'>
                        <span className='benchFieldLabel'>
                          {benchText(locale, '并发', 'Concurrency')}
                        </span>
                        <input
                          className='benchInput'
                          type='number'
                          min={1}
                          max={8}
                          value={settings.parallelism}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              parallelism: clampNumber(
                                Number(event.target.value),
                                1,
                                8,
                              ),
                            }))}
                        />
                      </label>
                    </div>
                    <label className='benchToggle'>
                      <input
                        type='checkbox'
                        checked={settings.repairEnabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            repairEnabled: event.target.checked,
                          }))}
                      />
                      <span>
                        {benchText(
                          locale,
                          '启用 Repair attempts',
                          'Enable Repair attempts',
                        )}
                      </span>
                    </label>
                    <label className='benchToggle'>
                      <input
                        type='checkbox'
                        checked={settings.judgeEnabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            judgeEnabled: event.target.checked,
                          }))}
                      />
                      <span>
                        {benchText(
                          locale,
                          '启用 UI Judge',
                          'Enable UI Judge',
                        )}
                      </span>
                    </label>
                    <label className='benchToggle'>
                      <input
                        type='checkbox'
                        checked={settings.collectLiveRenderMetrics}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            collectLiveRenderMetrics: event.target.checked,
                          }))}
                      />
                      <span>
                        {benchText(
                          locale,
                          '采集实时 Render metrics',
                          'Collect live Render metrics',
                        )}
                      </span>
                    </label>
                  </section>
                </div>

                <section className='benchConfigSection benchConfigScenarios'>
                  <div className='benchSectionHeader'>
                    <div>
                      <h3 className='benchSectionTitle'>
                        {benchText(locale, '场景', 'Scenarios')}
                      </h3>
                      <p className='benchSectionSub'>
                        {benchText(
                          locale,
                          '共享 Prompt 集合',
                          'Shared prompt collection',
                        )}
                      </p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={MessageSquarePlus}
                      onClick={addScenario}
                    >
                      {benchText(locale, '添加', 'Add')}
                    </Button>
                  </div>
                  <div className='benchScenarioList'>
                    {scenarios.map((scenario) => (
                      <div className='benchScenarioItem' key={scenario.id}>
                        <div className='benchScenarioTop'>
                          <input
                            className='benchInlineInput benchScenarioName'
                            value={getBenchScenarioDisplayName(
                              scenario,
                              locale,
                            )}
                            aria-label={benchText(
                              locale,
                              '场景名称',
                              'Scenario name',
                            )}
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                {
                                  name: event.target.value,
                                  systemName: undefined,
                                },
                              )}
                          />
                          <Button
                            variant='danger'
                            size='sm'
                            iconOnly
                            iconBefore={Trash2}
                            aria-label={benchText(
                              locale,
                              `删除 ${
                                getBenchScenarioDisplayName(scenario, locale)
                              }`,
                              `Delete ${
                                getBenchScenarioDisplayName(scenario, locale)
                              }`,
                            )}
                            title={benchText(
                              locale,
                              `删除 ${
                                getBenchScenarioDisplayName(scenario, locale)
                              }`,
                              `Delete ${
                                getBenchScenarioDisplayName(scenario, locale)
                              }`,
                            )}
                            disabled={scenarios.length <= 1}
                            onClick={() =>
                              removeScenario(scenario.id)}
                          />
                        </div>
                        <textarea
                          className='benchTextarea benchScenarioPrompt'
                          value={getBenchScenarioFieldText(
                            scenario.prompt,
                            scenario.systemPrompt,
                            locale,
                          )}
                          aria-label={`${
                            getBenchScenarioDisplayName(scenario, locale)
                          } prompt`}
                          onChange={(event) =>
                            updateScenario(
                              scenario.id,
                              {
                                prompt: event.target.value,
                                systemPrompt: undefined,
                              },
                            )}
                        />
                        <div className='benchScenarioMetaRow'>
                          <input
                            className='benchInlineInput'
                            value={getBenchScenarioFieldText(
                              scenario.type,
                              scenario.systemType,
                              locale,
                            )}
                            aria-label={`${
                              getBenchScenarioDisplayName(scenario, locale)
                            } type`}
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                {
                                  type: event.target.value,
                                  systemType: undefined,
                                },
                              )}
                          />
                          <input
                            className='benchInlineInput'
                            value={getBenchScenarioFieldText(
                              scenario.action,
                              scenario.systemAction,
                              locale,
                            )}
                            aria-label={`${
                              getBenchScenarioDisplayName(scenario, locale)
                            } action`}
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                {
                                  action: event.target.value,
                                  systemAction: undefined,
                                },
                              )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <footer className='benchConfigFooter'>
                <Button
                  variant='secondary'
                  size='md'
                  iconBefore={RotateCcw}
                  onClick={resetBench}
                >
                  {benchText(locale, '重置', 'Reset')}
                </Button>
                <Button
                  variant='primary'
                  size='md'
                  onClick={() => setConfigOpen(false)}
                >
                  {benchText(locale, '完成', 'Done')}
                </Button>
              </footer>
            </section>
          </div>
        )
        : null}
    </div>
  );
}
