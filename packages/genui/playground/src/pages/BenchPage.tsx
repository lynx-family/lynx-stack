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
import { copyToClipboard } from '../utils/clipboard.js';

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
}

interface BenchScenario {
  id: string;
  name: string;
  prompt: string;
  type: string;
  complexity: number;
  action: string;
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
  judgeScore: number;
  judgeStatus?: 'complete' | 'failed' | 'skipped';
  judgeWarnings?: string[];
  messageCount?: number;
  outputChars?: number;
  errors?: string[];
  error?: string;
  screenshotDataUrl?: string;
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
  baseURL?: string;
  model?: string;
  api?: 'chat' | 'responses';
}

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
const ONLINE_A2UI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
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

function isTrustedOnlineEndpoint(endpoint: URL): boolean {
  return endpoint.origin === ONLINE_A2UI_SERVER_ORIGIN;
}

function resolveTrustedA2UIEndpoint(raw: string): string | null {
  try {
    const endpoint = new URL(raw, window.location.origin);
    if (endpoint.origin === window.location.origin) return endpoint.toString();
    if (isTrustedOnlineEndpoint(endpoint)) return endpoint.toString();
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

  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/a2ui/bench/jobs`;
  }
  return `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/bench/jobs`;
}

function getA2UIBenchHealthEndpoint(): string {
  const jobsEndpoint = getA2UIBenchJobsEndpoint();
  try {
    const url = new URL(jobsEndpoint, window.location.origin);
    url.pathname = '/a2ui/health';
    url.search = '';
    return url.toString();
  } catch {
    return `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/health`;
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
    return `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/bench/jobs/${
      encodeURIComponent(jobId)
    }/report`;
  }
}

function getA2UIBenchJobEndpoint(jobId: string): string {
  const jobsEndpoint = getA2UIBenchJobsEndpoint();
  return `${jobsEndpoint}/${encodeURIComponent(jobId)}`;
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
    return endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_A2UI_SERVER_PORT
      && isDevHost(endpoint.hostname);
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
  healthError: string | null,
): string {
  if (health) return health.hasKey ? '已配置' : '未配置';
  if (healthError) return '状态未知';
  return '检查中…';
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
    scenarios,
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
  return groups.length > 0 ? groups : cloneBenchGroups(DEFAULT_GROUPS);
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
      type: item.type ?? '自定义',
      complexity: readFiniteNumber(item.complexity, 1),
      action: item.action ?? '',
    };
  });
  return scenarios.length > 0
    ? scenarios
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

function readBenchHistory(): BenchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BENCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => isBenchHistoryEntry(entry)).map((entry) => {
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
  } catch {
    return [];
  }
}

function persistBenchHistory(entries: BenchHistoryEntry[]): void {
  try {
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
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify(persistableEntries),
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
    report: sanitizeBenchReportValue(report) as BenchReport,
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

function sanitizeBenchReportValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/https?:\/\/[^\s"'<>]+/giu, '[redacted URL]')
      .replace(/Bearer\s+\S+/giu, 'Bearer [redacted]');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeBenchReportValue(item));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      isSensitiveBenchReportKey(key)
        ? []
        : [[key, sanitizeBenchReportValue(item)]]
    ),
  );
}

export function serializeBenchReport(report: BenchReport): string {
  return JSON.stringify(sanitizeBenchReportValue(report), null, 2);
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

function getRunButtonText(status: BenchStatus): string {
  if (status === 'running') return '运行中';
  if (status === 'failed') return '重新运行';
  return '运行 Bench';
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
  runMessage: string,
  runCount: number,
): string {
  if (status === 'running') {
    return `${Math.round(progress)}% · ${runMessage}`;
  }
  if (status === 'idle') return `计划运行 ${runCount} Runs`;
  return runMessage;
}

function getReportSubtitle(
  report: BenchReport | null,
  reportIsStale: boolean,
): string {
  if (!report) return '暂无报告';
  if (reportIsStale) return '当前计划已变更 · 显示上次 Report';
  return new Date(report.createdAt).toLocaleString();
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
  return `${summary.avgJudgeScore.toFixed(1)}/5`;
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
  return `${result.judgeScore.toFixed(1)}/5`;
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
): string {
  if (state === 'captured') return '已截图';
  if (state === 'failed') return '运行失败';
  return '无截图';
}

function getScreenshotPlaceholderText(result: BenchResult | null): string {
  if (!result) {
    return '这个位置没有收到 Bench 结果。';
  }
  if (isBenchRunFailed(result)) {
    return result.error
      ?? result.errors?.[0]
      ?? '截图前运行已失败。';
  }
  return result.errors?.find((error) =>
    error.toLowerCase().includes('screenshot')
  ) ?? '这次运行没有保存截图。';
}

function createBenchGroupsForMatrix(report: BenchReport): BenchGroup[] {
  const reportGroups = Array.isArray(report.groups) ? report.groups : [];
  if (reportGroups.length > 0) return createBenchGroupsFromReport(report);

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
    ? groupsFromResults
    : cloneBenchGroups(DEFAULT_GROUPS);
}

function createBenchScenariosForMatrix(report: BenchReport): BenchScenario[] {
  const reportScenarios = Array.isArray(report.scenarios)
    ? report.scenarios
    : [];
  if (reportScenarios.length > 0) return createBenchScenariosFromReport(report);

  const seen = new Set<string>();
  const scenariosFromResults = report.results.flatMap((result) => {
    if (seen.has(result.scenarioId)) return [];
    seen.add(result.scenarioId);
    return [{
      id: result.scenarioId,
      name: result.scenarioName,
      prompt: '',
      type: '自定义',
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
  })[0] ?? groups[0];
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

function getBenchRunBlockers(
  activeGroupCount: number,
  scenarioCount: number,
  repeats: number,
): string[] {
  const issues: string[] = [];
  if (activeGroupCount === 0) {
    issues.push('至少启用一个对比组。');
  }
  if (scenarioCount === 0) {
    issues.push('至少添加一个场景。');
  }
  if (repeats < 1) {
    issues.push('Repeats 不能小于 1。');
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
  showHeader?: boolean;
}

export function BenchPage({ showHeader = true }: BenchPageProps) {
  const [env, setEnv] = useState<BenchEnv>(DEFAULT_ENV);
  const [groups, setGroups] = useState<BenchGroup[]>(EMPTY_GROUPS);
  const [scenarios, setScenarios] = useState<BenchScenario[]>(
    DEFAULT_SCENARIOS,
  );
  const [settings, setSettings] = useState<BenchSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<BenchStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [runMessage, setRunMessage] = useState('准备就绪');
  const [configOpen, setConfigOpen] = useState(false);
  const [benchRunNoticeOpen, setBenchRunNoticeOpen] = useState(false);
  const [benchHealth, setBenchHealth] = useState<BenchHealth | null>(null);
  const [benchHealthError, setBenchHealthError] = useState<string | null>(null);
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
  const benchAbortRef = useRef<AbortController | null>(null);
  const historyReportAbortRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.enabled),
    [groups],
  );
  const controlGroupCount = useMemo(
    () => groups.filter((group) => group.role === 'control').length,
    [groups],
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
    () => [...new Set(scenarios.map((scenario) => scenario.type))],
    [scenarios],
  );
  const providerConfigured = useMemo(() => isProviderConfigured(env), [env]);
  const benchRunBlockers = useMemo(
    () =>
      getBenchRunBlockers(
        activeGroups.length,
        scenarios.length,
        settings.repeats,
      ),
    [activeGroups.length, scenarios.length, settings.repeats],
  );

  const clearActiveJobConnection = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    benchAbortRef.current?.abort();
    benchAbortRef.current = null;
    historyReportAbortRef.current?.abort();
    historyReportAbortRef.current = null;
  }, []);

  const cancelActiveBenchJob = useCallback(() => {
    const jobId = activeJobIdRef.current;
    activeJobIdRef.current = null;
    clearActiveJobConnection();
    if (!jobId) return;
    void window.fetch(getA2UIBenchJobEndpoint(jobId), {
      method: 'DELETE',
    }).catch(() => {
      // Cancellation is best-effort; resetting the local runner must still
      // work if the server has already finalized or expired the job.
    });
  }, [clearActiveJobConnection]);

  useEffect(() => clearActiveJobConnection, [clearActiveJobConnection]);

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
    setRunMessage(`正在载入 Report ${jobId.slice(0, 8)}…`);

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
          throw new Error(
            'error' in payload && payload.error
              ? payload.error
              : `Report 载入失败：${response.status}`,
          );
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
        setGroups(cloneBenchGroups(historyEntry.config.groups));
        setScenarios(cloneBenchScenarios(historyEntry.config.scenarios));
        setSettings(cloneBenchSettings(historyEntry.config.settings));
        setHistoryItems((current) => {
          const next = upsertBenchHistoryEntry(current, historyEntry);
          persistBenchHistory(next);
          return next;
        });
        setStatus(payload.status ?? 'complete');
        setProgress(100);
        setRunMessage(
          payload.summary && payload.summary.failedRuns > 0
            ? `Report 已载入 · ${payload.summary.failedRuns} 个失败 Run`
            : 'Report 已载入',
        );
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
        setRunMessage(getErrorMessage(error));
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
        name: role === 'control' ? '新基准组' : '新对比组',
        variable: 'custom',
        model: env.model || DEFAULT_ENV.model,
        catalog: 'Full Catalog',
        extraInstruction: '',
        enabled: true,
      },
    ]);
  }, [env.model]);

  const loadGroupPreset = useCallback((
    preset: BenchGroupPreset,
  ) => {
    cancelActiveBenchJob();
    const presetGroups = getBenchGroupPreset(preset);
    setGroups(cloneBenchGroups(presetGroups));
    if (preset === 'protocol-pair' || preset === 'combined') {
      setSettings((current) => ({ ...current, parallelism: 1 }));
    }
    setReport(null);
    setReportPlanSignature(null);
    setStatus('idle');
    setProgress(0);
    setRunMessage('已载入预设');
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
        name: '自定义场景',
        prompt: '描述需要生成和评测的 UI。',
        type: '自定义',
        complexity: 1,
        action: '主操作',
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
    cancelActiveBenchJob();
    setEnv(DEFAULT_ENV);
    setGroups(EMPTY_GROUPS);
    setScenarios(DEFAULT_SCENARIOS);
    setSettings(DEFAULT_SETTINGS);
    setStatus('idle');
    setProgress(0);
    setRunMessage('准备就绪');
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
          throw new Error(`Provider 状态检查失败：${response.status}`);
        }
        setBenchHealth(await response.json() as BenchHealth);
      } catch (error) {
        setBenchHealthError(getErrorMessage(error));
      }
    })();
  }, []);

  const startBench = useCallback((confirmedServerDefaults = false) => {
    if (benchRunBlockers.length > 0 || runCount === 0) {
      setBenchRunNoticeOpen(true);
      setRunMessage('请先完成运行配置');
      return;
    }
    if (!providerConfigured && !confirmedServerDefaults) {
      setBenchRunNoticeOpen(true);
      setRunMessage('请确认使用服务端默认配置');
      loadBenchHealth();
      return;
    }
    cancelActiveBenchJob();
    setStatus('running');
    setProgress(0);
    setRunMessage('正在创建 Bench 任务…');
    setReport(null);
    setReportPlanSignature(null);
    setScreenshotsOpen(false);

    const controller = new AbortController();
    benchAbortRef.current = controller;

    void (async () => {
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
            groups: runGroups,
            scenarios,
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(
          () => ({}),
        ) as BenchJobCreated;
        if (!response.ok || payload.ok === false || !payload.jobId) {
          throw new Error(
            payload.error ?? `Bench 请求失败：${response.status}`,
          );
        }

        activeJobIdRef.current = payload.jobId;
        setRunMessage(
          payload.warnings && payload.warnings.length > 0
            ? payload.warnings[0]
            : `Job ${payload.jobId.slice(0, 8)} 已进入队列`,
        );

        const eventsUrl = new URL(
          payload.eventsUrl ?? `/a2ui/bench/jobs/${payload.jobId}/events`,
          jobsEndpoint,
        ).toString();
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const source = new EventSource(eventsUrl);
        eventSourceRef.current = source;

        const updateProgress = (
          progressPayload: BenchJobSnapshot['progress'],
        ) => {
          const completed = progressPayload?.completedRuns ?? 0;
          const total = progressPayload?.totalRuns ?? runCount;
          setProgress(total > 0 ? Math.min(100, (completed / total) * 100) : 0);
        };

        const describeRun = (value: unknown): string => {
          if (!value || typeof value !== 'object') return 'Bench 运行中…';
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
          const groupName = runGroups.find((group) => group.id === groupId)
            ?.name ?? '对比组';
          const scenarioName = scenarios.find((scenario) =>
            scenario.id === scenarioId
          )?.name ?? '场景';
          return `${groupName} · ${scenarioName} · #${
            repeatIndex ?? 1
          } · ${phase}`;
        };

        source.addEventListener('job', (event) => {
          const snapshot = readEventData<BenchJobSnapshot>(
            event as MessageEvent<unknown>,
          );
          if (!snapshot) return;
          updateProgress(snapshot.progress);
          if (snapshot.status === 'failed') {
            setStatus('failed');
            activeJobIdRef.current = null;
            setRunMessage(snapshot.error ?? 'Bench 任务失败');
          } else if (snapshot.status === 'cancelled') {
            setStatus('cancelled');
            activeJobIdRef.current = null;
            setRunMessage('Bench 任务已取消');
          } else if (snapshot.status === 'complete') {
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
          activeJobIdRef.current = null;
          setProgress(100);
          setRunMessage(
            nextReport.summary && nextReport.summary.failedRuns > 0
              ? `Bench 完成 · ${nextReport.summary.failedRuns} 个失败 Run`
              : 'Bench 完成',
          );
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
            setRunMessage('正在重连 Bench 数据流…');
            return;
          }
          setStatus('failed');
          activeJobIdRef.current = null;
          setRunMessage(message ?? 'Bench 数据流已断开');
          source.close();
          if (eventSourceRef.current === source) eventSourceRef.current = null;
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus('failed');
        setRunMessage(getErrorMessage(error));
      } finally {
        if (benchAbortRef.current === controller) {
          benchAbortRef.current = null;
        }
      }
    })();
  }, [
    benchRunBlockers.length,
    cancelActiveBenchJob,
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
    const copied = await copyToClipboard(serializeBenchReport(report));
    if (!copied) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1200);
  }, [report]);

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
    cancelActiveBenchJob();
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
    setGroups(cloneBenchGroups(entry.config.groups));
    setScenarios(cloneBenchScenarios(entry.config.scenarios));
    setSettings(cloneBenchSettings(entry.config.settings));
    setReport(entry.report);
    setReportPlanSignature(restoredSignature);
    setStatus(entry.report.status ?? 'complete');
    setProgress(100);
    setRunMessage(
      entry.report.summary && entry.report.summary.failedRuns > 0
        ? `历史 Report 已载入 · ${entry.report.summary.failedRuns} 个失败 Run`
        : '历史 Report 已载入',
    );
    setHistoryOpen(false);
    const jobId = entry.report.jobId;
    if (!jobId) return;

    setRunMessage('配置已恢复，正在载入完整 Report…');
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
          throw new Error('完整 Report 暂不可用');
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
        setRunMessage('完整 Report 已载入');
      } catch {
        if (
          !shouldApplyBenchReportRequest(
            controller,
            historyReportAbortRef.current,
          )
        ) {
          return;
        }
        setRunMessage('配置已恢复 · 完整 Report 暂不可用');
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

  return (
    <div className='benchPage'>
      {showHeader
        ? (
          <PageHeader
            className='benchHeader'
            title='Bench Runner'
            description='自由组合 Protocol、Model、Prompt 与 Catalog，并在同一份 Report 中查看结果。'
            topContent={
              <>
                <span className='chip'>{activeGroups.length} 个对比组</span>
                <span className='chip'>{scenarios.length} 个场景</span>
                <span className='chip'>{runCount} Runs</span>
              </>
            }
          />
        )
        : <h2 className='benchPageAccessibleTitle'>通用 Bench Runner</h2>}

      <div
        className='benchBody'
        data-report-resizing={isResizingReport}
        ref={benchBodyRef}
        style={benchBodyStyle}
      >
        <main className='benchMain' aria-label='Bench 工作区'>
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
                  {getRunButtonText(status)}
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  iconBefore={Zap}
                  disabled={planLocked}
                  onClick={() => setConfigOpen(true)}
                >
                  运行设置
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  iconOnly
                  iconBefore={RotateCcw}
                  aria-label={planLocked ? '停止并重置 Bench' : '重置 Bench'}
                  title={planLocked ? '停止并重置 Bench' : '重置 Bench'}
                  onClick={resetBench}
                />
              </div>
              <div
                className='benchProgressTrack'
                role='progressbar'
                aria-label='Bench 进度'
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
                {getRunMetaText(status, progress, runMessage, runCount)}
              </div>
            </div>
            <div className='benchPlanSummary'>
              <div className='benchPlanItem'>
                <span>Protocol</span>
                <strong>
                  {activeProtocols.map((protocol) =>
                    protocol === 'a2ui' ? 'A2UI' : 'OpenUI'
                  ).join(' + ') || '未选择'}
                </strong>
                <small>{activeGroups.length} 个对比组</small>
              </div>
              <div className='benchPlanItem'>
                <span>运行参数</span>
                <strong>
                  重复 {settings.repeats} 次 / 并发 {settings.parallelism}
                </strong>
                <small>
                  UI Judge {settings.judgeEnabled ? '开启' : '关闭'} · Repair
                  {' '}
                  {settings.repairEnabled ? '开启' : '关闭'}
                </small>
              </div>
              <div className='benchPlanItem'>
                <span>场景</span>
                <strong>{scenarios.length} 个 Prompt</strong>
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
                <h3 className='benchSectionTitle'>对比组</h3>
                <p className='benchSectionSub'>
                  每个组都是一条可组合的运行条件
                </p>
              </div>
              <div className='benchHeaderActions'>
                <details className='benchTemplateMenu'>
                  <summary>载入预设</summary>
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
                      A2UI 变量对比
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
                      Protocol 对照
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
                      组合示例
                      <small>把两类条件放进同一张 plan</small>
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
                      空白 plan
                      <small>从一个 Baseline 开始</small>
                    </button>
                  </div>
                </details>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={MessageSquarePlus}
                  onClick={() => addGroup('experiment')}
                >
                  添加对比组
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
                        aria-label={`启用 ${group.name}`}
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
                            && controlGroupCount === 1}
                          key={role}
                          onClick={() =>
                            updateGroup(group.id, groupPatch('role', role))}
                        >
                          {role === 'control' ? '基准' : '对比'}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant='danger'
                      size='sm'
                      iconOnly
                      iconBefore={Trash2}
                      aria-label={`删除 ${group.name}`}
                      title={`删除 ${group.name}`}
                      disabled={groups.length <= 1}
                      onClick={() => removeGroup(group.id)}
                    />
                  </div>
                  <input
                    className='benchGroupName'
                    value={group.name}
                    aria-label='对比组名称'
                    onChange={(event) =>
                      updateGroup(
                        group.id,
                        groupPatch('name', event.target.value),
                      )}
                  />
                  <div className='benchGroupSummary'>
                    <span data-protocol={group.protocol}>
                      {group.protocol === 'a2ui' ? 'A2UI' : 'OpenUI'}
                    </span>
                    <span>{group.profile}</span>
                    <span>{group.model || env.model}</span>
                    {(groupDifferences.get(group.id) ?? []).length === 0
                      ? <span data-baseline='true'>基准</span>
                      : (groupDifferences.get(group.id) ?? []).map(
                        (difference) => (
                          <span data-changed='true' key={difference}>
                            {difference} 已变更
                          </span>
                        ),
                      )}
                    {group.role === 'experiment'
                        && groupBaselines.get(group.id)
                      ? (
                        <span data-baseline='true'>
                          相对 {groupBaselines.get(group.id)?.name}
                        </span>
                      )
                      : null}
                  </div>
                  <details className='benchGroupDetails'>
                    <summary>配置</summary>
                    <div className='benchGroupFields'>
                      <div className='benchField'>
                        <span className='benchFieldLabel'>Protocol</span>
                        <BenchDropdown
                          ariaLabel={`${group.name} Protocol`}
                          value={group.protocol}
                          options={[
                            {
                              value: 'a2ui',
                              label: 'A2UI',
                              description: '结构化消息流',
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
                          ariaLabel={`${group.name} Profile`}
                          value={group.profile}
                          disabled={group.protocol === 'openui'}
                          options={[
                            {
                              value: 'native',
                              label: 'native',
                              description: '使用完整协议能力',
                            },
                            {
                              value: 'matched-core',
                              label: 'matched-core',
                              description: '只使用公共能力子集',
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
                          <strong>matched-core</strong>{' '}
                          只使用 A2UI 与 OpenUI 都支持的公共能力，适合做同条件
                          Protocol 对照。
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
                          ariaLabel={`${group.name} Catalog`}
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
                        Prompt 附加指令
                      </span>
                      <textarea
                        className='benchTextarea'
                        value={group.extraInstruction}
                        placeholder='只对这个对比组追加的 Prompt'
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
                <h3 className='benchSectionTitle'>共享场景</h3>
                <p className='benchSectionSub'>
                  {activeGroups.length} 个对比组 × {scenarios.length} 个场景 ×
                  {' '}
                  重复 {settings.repeats} 次 = {runCount} Runs
                </p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                iconBefore={Zap}
                disabled={planLocked}
                onClick={() => setConfigOpen(true)}
              >
                编辑场景
              </Button>
            </div>
            <div className='benchScenarioChips'>
              {scenarios.map((scenario) => (
                <span className='benchScenarioChip' key={scenario.id}>
                  {scenario.name}
                </span>
              ))}
            </div>
          </section>
        </main>

        <div
          className='benchResizeHandle'
          role='separator'
          aria-label='调整 Report 面板宽度'
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
                {getReportSubtitle(report, reportIsStale)}
              </p>
            </div>
            <div className='benchReportActions'>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={History}
                onClick={() => setHistoryOpen(true)}
              >
                历史
              </Button>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={Copy}
                disabled={!report}
                onClick={() => void copyReport()}
              >
                {copyState === 'copied' ? '已复制' : 'JSON'}
              </Button>
            </div>
          </div>

          {report && report.summaries.length > 0
            ? (
              <>
                <div className='benchInsightGrid'>
                  <div className='benchInsight'>
                    <span>Token 最低</span>
                    <strong>{bestTokens?.groupName ?? 'n/a'}</strong>
                    <small>
                      {bestTokens
                        ? formatNumber(bestTokens.avgTokens)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>Agent 最快</span>
                    <strong>{fastestAgent?.groupName ?? 'n/a'}</strong>
                    <small>
                      {fastestAgent
                        ? formatMs(fastestAgent.avgAgentMs)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>Judge 最佳</span>
                    <strong>{topJudge?.groupName ?? 'n/a'}</strong>
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
                        <th>对比组</th>
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
                                  {summary.groupName}
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
                      <h3 className='benchSectionTitle'>运行截图</h3>
                      <p className='benchSectionSub'>
                        每个 run 的实际渲染截图，失败位置也会保留
                      </p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={Maximize2}
                      disabled={screenshotMatrix.total === 0}
                      onClick={() => setScreenshotsOpen(true)}
                    >
                      查看截图
                    </Button>
                  </div>
                  <div className='benchScreenshotSummaryGrid'>
                    <div>
                      <span>Runs</span>
                      <strong>{formatNumber(screenshotMatrix.total)}</strong>
                    </div>
                    <div>
                      <span>已截图</span>
                      <strong>
                        {formatNumber(screenshotMatrix.captured)}
                      </strong>
                    </div>
                    <div>
                      <span>失败</span>
                      <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                    </div>
                    <div>
                      <span>缺失</span>
                      <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                    </div>
                  </div>
                </section>

                <div className='benchReportNotes'>
                  <span>
                    Agent、Token、Attempts 与校验数据由服务端采集；Render 或 UI
                    Judge 不可用时会明确标记。
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
                <strong>等待 Bench 数据</strong>
                <span>运行当前计划后，这里会生成统一 Report。</span>
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
                    运行截图
                  </h2>
                  <p className='benchConfigSub'>
                    {screenshotMatrix.rows.length} 个对比组 ×{' '}
                    {screenshotMatrix.scenarios.length} 个场景 · 重复{' '}
                    {screenshotMatrix.repeatCount} 次
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label='关闭截图'
                  title='关闭截图'
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
                    <span>已截图</span>
                    <strong>{formatNumber(screenshotMatrix.captured)}</strong>
                  </div>
                  <div>
                    <span>失败</span>
                    <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                  </div>
                  <div>
                    <span>缺失</span>
                    <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                  </div>
                </div>

                <div className='benchScreenshotMatrixWrap'>
                  <div
                    className='benchScreenshotMatrix'
                    style={screenshotMatrixStyle}
                  >
                    <div className='benchScreenshotMatrixCorner'>对比组</div>
                    {screenshotMatrix.scenarios.map((scenario) => (
                      <div
                        className='benchScreenshotScenarioHeader'
                        key={scenario.id}
                      >
                        <strong>{scenario.name}</strong>
                        <span>{scenario.type}</span>
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
                            <strong>{row.group.name}</strong>
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
                                      )}
                                    </span>
                                  </div>
                                  {item?.screenshotDataUrl
                                    ? (
                                      <div className='benchScreenshotImageFrame'>
                                        <img
                                          alt={`${cell.group.name} ${cell.scenario.name} #${slot.repeatIndex}`}
                                          src={item.screenshotDataUrl}
                                        />
                                      </div>
                                    )
                                    : (
                                      <div className='benchScreenshotPlaceholder'>
                                        <strong>
                                          {getScreenshotStateLabelFromState(
                                            slot.state,
                                          )}
                                        </strong>
                                        <span>
                                          {getScreenshotPlaceholderText(item)}
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
                                      : <span>无结果</span>}
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
                  完成
                </Button>
              </footer>
              <div
                className='benchScreenshotResizeHandle'
                role='separator'
                aria-label='调整截图弹窗宽度'
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
                    Bench 历史
                  </h2>
                  <p className='benchConfigSub'>
                    {historyItems.length > 0
                      ? `已保存 ${historyItems.length} 次运行`
                      : '还没有保存的运行'}
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label='关闭 Bench 历史'
                  title='关闭 Bench 历史'
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
                                  {new Date(entry.savedAt).toLocaleString()}
                                </p>
                              </div>
                              <span
                                className='benchHistoryStatus'
                                data-tone={failedRuns > 0 ? 'warn' : 'ok'}
                              >
                                {failedRuns > 0
                                  ? `${failedRuns} 个失败 Run`
                                  : '通过'}
                              </span>
                            </div>

                            <div className='benchHistoryStats'>
                              <div>
                                <span>Runs</span>
                                <strong>{formatNumber(totalRuns)}</strong>
                              </div>
                              <div>
                                <span>成功率</span>
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
                                  ? 'API key 已配置'
                                  : '无 API key'}
                              </span>
                              <span>
                                重复 {entry.config.settings.repeats} 次 / 并发
                                {' '}
                                {entry.config.settings.parallelism}
                              </span>
                              <span>
                                {entry.config.groups.length} 个对比组 ·{' '}
                                {entry.config.scenarios.length} 个场景
                              </span>
                              {jobId
                                ? <span>job {jobId.slice(0, 8)}</span>
                                : null}
                            </div>

                            <details className='benchHistoryDetails'>
                              <summary>配置快照</summary>
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
                                      <span>恢复链接</span>
                                      <strong>{recoveryUrl}</strong>
                                    </div>
                                  )
                                  : null}
                                <div>
                                  <span>对比组</span>
                                  <strong>
                                    {entry.config.groups.map((group) =>
                                      `${group.name} (${group.model})`
                                    ).join(', ')}
                                  </strong>
                                </div>
                                <div>
                                  <span>场景</span>
                                  <strong>
                                    {entry.config.scenarios.map((scenario) =>
                                      scenario.name
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
                                恢复
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
                                    ? '已复制'
                                    : '复制链接'}
                                </Button>
                                <Button
                                  variant='secondary'
                                  size='sm'
                                  iconBefore={Trash2}
                                  onClick={() => deleteHistoryEntry(entry.id)}
                                >
                                  删除
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
                      <strong>暂无历史</strong>
                      <span>完成的 Bench 会自动保存在这里。</span>
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
                  清空历史
                </Button>
                <Button
                  variant='primary'
                  size='sm'
                  onClick={() => setHistoryOpen(false)}
                >
                  完成
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
                        ? '还不能运行 Bench'
                        : '使用服务端默认配置？'}
                    </h2>
                    <p id='bench-run-notice-desc' className='benchConfigSub'>
                      {benchRunBlockers.length > 0
                        ? '请先补全下面的必要配置。'
                        : '当前没有填写自定义 Provider。'}
                    </p>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label='关闭提示'
                  title='关闭提示'
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
                        本次运行将使用服务端已配置的 Provider，浏览器不会发送
                        Provider 密钥、地址或默认 Model。
                      </p>
                      <div className='benchRunHealthCard'>
                        <div>
                          <span>API key</span>
                          <strong>
                            {getBenchHealthKeyLabel(
                              benchHealth,
                              benchHealthError,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Model</span>
                          <strong>
                            {benchHealth?.model ?? '服务端默认'}
                          </strong>
                        </div>
                      </div>
                      {benchHealthError
                        ? (
                          <p className='benchRunNoticeError'>
                            {benchHealthError}
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
                  关闭
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
                  去配置
                </Button>
                {benchRunBlockers.length === 0
                  ? (
                    <Button
                      variant='primary'
                      size='md'
                      iconBefore={Play}
                      disabled={benchHealth?.hasKey === false}
                      onClick={() => {
                        setBenchRunNoticeOpen(false);
                        startBench(true);
                      }}
                    >
                      使用默认配置运行
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
                    运行设置
                  </h2>
                  <p className='benchConfigSub'>
                    配置 Provider、运行参数与场景。
                  </p>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label='关闭运行设置'
                  title='关闭运行设置'
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
                        {env.apiKey.trim() ? 'Key 已配置' : '无 Key'}
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
                        新建对比组的默认 Model
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
                        <h3 className='benchSectionTitle'>运行参数</h3>
                        <p className='benchSectionSub'>
                          Repeats、并发与检查项
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
                        <span className='benchFieldLabel'>并发</span>
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
                      <span>启用 Repair attempts</span>
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
                      <span>启用 UI Judge</span>
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
                      <span>采集实时 Render metrics</span>
                    </label>
                  </section>
                </div>

                <section className='benchConfigSection benchConfigScenarios'>
                  <div className='benchSectionHeader'>
                    <div>
                      <h3 className='benchSectionTitle'>场景</h3>
                      <p className='benchSectionSub'>共享 Prompt 集合</p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={MessageSquarePlus}
                      onClick={addScenario}
                    >
                      添加
                    </Button>
                  </div>
                  <div className='benchScenarioList'>
                    {scenarios.map((scenario) => (
                      <div className='benchScenarioItem' key={scenario.id}>
                        <div className='benchScenarioTop'>
                          <input
                            className='benchInlineInput benchScenarioName'
                            value={scenario.name}
                            aria-label='场景名称'
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                { name: event.target.value },
                              )}
                          />
                          <Button
                            variant='danger'
                            size='sm'
                            iconOnly
                            iconBefore={Trash2}
                            aria-label={`删除 ${scenario.name}`}
                            title={`删除 ${scenario.name}`}
                            disabled={scenarios.length <= 1}
                            onClick={() =>
                              removeScenario(scenario.id)}
                          />
                        </div>
                        <textarea
                          className='benchTextarea benchScenarioPrompt'
                          value={scenario.prompt}
                          aria-label={`${scenario.name} prompt`}
                          onChange={(event) =>
                            updateScenario(
                              scenario.id,
                              { prompt: event.target.value },
                            )}
                        />
                        <div className='benchScenarioMetaRow'>
                          <input
                            className='benchInlineInput'
                            value={scenario.type}
                            aria-label={`${scenario.name} type`}
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                { type: event.target.value },
                              )}
                          />
                          <input
                            className='benchInlineInput'
                            value={scenario.action}
                            aria-label={`${scenario.name} action`}
                            onChange={(event) =>
                              updateScenario(
                                scenario.id,
                                { action: event.target.value },
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
                  重置
                </Button>
                <Button
                  variant='primary'
                  size='md'
                  onClick={() => setConfigOpen(false)}
                >
                  完成
                </Button>
              </footer>
            </section>
          </div>
        )
        : null}
    </div>
  );
}
