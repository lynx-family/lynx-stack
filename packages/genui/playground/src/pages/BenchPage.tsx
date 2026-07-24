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
  ArrowUpRight,
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
type BenchVariable = 'model' | 'prompt' | 'catalog' | 'custom';
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
  runCount?: number;
  failedRuns?: number;
  successRate?: number;
  avgTokens: number;
  avgAgentMs: number;
  avgFmpMs: number;
  avgTtiMs: number;
  avgRenderMs: number;
  avgJudgeScore: number;
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
    baseURL: string;
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
    baseURL: string;
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
    name: 'Default Prompt',
    variable: 'prompt',
    model: 'gpt-5.5-2026-04-24',
    catalog: 'Full Catalog',
    extraInstruction: '',
    enabled: true,
  },
  {
    id: 'experiment-token',
    role: 'experiment',
    name: 'Token Efficient',
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
    name: 'Core Catalog',
    variable: 'catalog',
    model: 'gpt-5.5-2026-04-24',
    catalog: 'Core Catalog',
    extraInstruction: '',
    enabled: true,
  },
];

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

function getProviderPlanLabel(
  env: BenchEnv,
  providerConfigured: boolean,
): string {
  if (!providerConfigured) return 'Server default';
  return env.model || 'Model override';
}

function getProviderPlanMeta(
  env: BenchEnv,
  providerConfigured: boolean,
): string {
  if (!providerConfigured) return 'From /a2ui/health';
  return env.apiKey.trim() ? 'Key set' : 'No key';
}

function getBenchHealthKeyLabel(
  health: BenchHealth | null,
  healthError: string | null,
): string {
  if (health) return health.hasKey ? 'Configured' : 'Missing';
  if (healthError) return 'Unknown';
  return 'Checking...';
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
  return value === 'model'
    || value === 'prompt'
    || value === 'catalog'
    || value === 'custom';
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
    return {
      id: item.id ?? createId(`history-group-${index + 1}`),
      role: isBenchRole(item.role) ? item.role : 'experiment',
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
      type: item.type ?? 'Custom',
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
    return parsed.filter((entry) => isBenchHistoryEntry(entry)).slice(
      0,
      BENCH_HISTORY_LIMIT,
    );
  } catch {
    return [];
  }
}

function persistBenchHistory(entries: BenchHistoryEntry[]): void {
  try {
    window.localStorage.setItem(
      BENCH_HISTORY_STORAGE_KEY,
      JSON.stringify(entries.slice(0, BENCH_HISTORY_LIMIT)),
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
  return {
    id: createId('bench-history'),
    title: `${report.env.model || env.model} · ${pluralize(totalRuns, 'run')}`,
    savedAt: new Date().toISOString(),
    report,
    config: {
      env: {
        apiKeyConfigured: Boolean(env.apiKey.trim())
          || report.env.apiKeyConfigured,
        baseURL: env.baseURL || report.env.baseURL,
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
      baseURL: report.env?.baseURL || DEFAULT_ENV.baseURL,
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

function readEventData<T>(event: MessageEvent<unknown>): T | null {
  if (typeof event.data !== 'string') return null;
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deltaText(value: number, baseline: number, suffix = ''): string {
  if (baseline === 0) return 'n/a';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%${suffix}`;
}

function getRunButtonText(status: BenchStatus): string {
  if (status === 'running') return 'Running';
  if (status === 'failed') return 'Retry Bench';
  return 'Run Bench';
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
  if (status === 'idle') return `${pluralize(runCount, 'planned run')}`;
  return runMessage;
}

function formatReportJudgeMetric(report: BenchReport | null): string {
  if (report?.capabilities?.judge === 'disabled') return 'off';
  if (!report || report.summaries.length === 0) return 'n/a';
  return `${
    average(report.summaries.map((item) => item.avgJudgeScore)).toFixed(1)
  }/5`;
}

function formatSummaryJudgeMetric(
  report: BenchReport,
  settings: BenchSettings,
  summary: BenchGroupSummary,
): string {
  if (!settings.judgeEnabled || report.capabilities?.judge === 'disabled') {
    return 'off';
  }
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
  if (state === 'captured') return 'Captured';
  if (state === 'failed') return 'Failed';
  return 'No capture';
}

function getScreenshotPlaceholderText(result: BenchResult | null): string {
  if (!result) {
    return 'No bench result was reported for this slot.';
  }
  if (isBenchRunFailed(result)) {
    return result.error
      ?? result.errors?.[0]
      ?? 'Run failed before a screenshot was captured.';
  }
  return result.errors?.find((error) =>
    error.toLowerCase().includes('screenshot')
  ) ?? 'No screenshot was captured for this run.';
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
      type: 'Custom',
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

function getBenchRunBlockers(
  activeGroupCount: number,
  scenarioCount: number,
  repeats: number,
): string[] {
  const issues: string[] = [];
  if (activeGroupCount === 0) {
    issues.push('Enable at least one control or experiment group.');
  }
  if (scenarioCount === 0) {
    issues.push('Add at least one scenario.');
  }
  if (repeats < 1) {
    issues.push('Set repeats to at least 1.');
  }
  return issues;
}

interface BenchPageProps {
  showHeader?: boolean;
}

export function BenchPage({ showHeader = true }: BenchPageProps) {
  const [env, setEnv] = useState<BenchEnv>(DEFAULT_ENV);
  const [groups, setGroups] = useState<BenchGroup[]>(DEFAULT_GROUPS);
  const [scenarios, setScenarios] = useState<BenchScenario[]>(
    DEFAULT_SCENARIOS,
  );
  const [settings, setSettings] = useState<BenchSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<BenchStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [runMessage, setRunMessage] = useState('Ready');
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

  const activeGroups = useMemo(
    () => groups.filter((group) => group.enabled),
    [groups],
  );
  const runCount = activeGroups.length * scenarios.length * settings.repeats;
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
  }, []);

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
    setStatus('running');
    setProgress(0);
    setRunMessage(`Loading report ${jobId.slice(0, 8)}...`);

    void (async () => {
      try {
        const response = await window.fetch(getA2UIBenchReportEndpoint(jobId));
        const payload = await response.json().catch(() => ({})) as
          | BenchReport
          | { error?: string };
        if (!response.ok || !('results' in payload)) {
          throw new Error(
            'error' in payload && payload.error
              ? payload.error
              : `Bench report load failed: ${response.status}`,
          );
        }
        if (cancelled) return;
        const historyEntry = createBenchHistoryEntryFromReport(payload);
        setReport(payload);
        setEnv((current) => ({
          apiKey: current.apiKey,
          baseURL: historyEntry.config.env.baseURL,
          model: historyEntry.config.env.model,
        }));
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
            ? `Loaded report with ${
              pluralize(payload.summary.failedRuns, 'failed run')
            }`
            : 'Loaded report',
        );
      } catch (error) {
        if (cancelled) return;
        setStatus('failed');
        setRunMessage(getErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
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
        name: role === 'control' ? 'New Control' : 'New Experiment',
        variable: 'custom',
        model: DEFAULT_ENV.model,
        catalog: 'Full Catalog',
        extraInstruction: '',
        enabled: true,
      },
    ]);
  }, []);

  const removeGroup = useCallback((id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id));
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
        name: 'Custom Scenario',
        prompt: 'Describe the A2UI scenario to benchmark.',
        type: 'Custom',
        complexity: 1,
        action: 'Primary Action',
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
    clearActiveJobConnection();
    setEnv(DEFAULT_ENV);
    setGroups(DEFAULT_GROUPS);
    setScenarios(DEFAULT_SCENARIOS);
    setSettings(DEFAULT_SETTINGS);
    setStatus('idle');
    setProgress(0);
    setRunMessage('Ready');
    setReport(null);
    setBenchHealth(null);
    setBenchHealthError(null);
    setBenchRunNoticeOpen(false);
    setScreenshotsOpen(false);
  }, [clearActiveJobConnection]);

  const loadBenchHealth = useCallback(() => {
    setBenchHealth(null);
    setBenchHealthError(null);
    void (async () => {
      try {
        const response = await window.fetch(getA2UIBenchHealthEndpoint());
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
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
      setRunMessage('Configuration required');
      return;
    }
    if (!providerConfigured && !confirmedServerDefaults) {
      setBenchRunNoticeOpen(true);
      setRunMessage('Confirm server defaults');
      loadBenchHealth();
      return;
    }
    clearActiveJobConnection();
    setStatus('running');
    setProgress(0);
    setRunMessage('Creating bench job...');
    setReport(null);
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
            groups: activeGroups,
            scenarios,
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(
          () => ({}),
        ) as BenchJobCreated;
        if (!response.ok || payload.ok === false || !payload.jobId) {
          throw new Error(
            payload.error ?? `Bench request failed: ${response.status}`,
          );
        }

        setRunMessage(
          payload.warnings && payload.warnings.length > 0
            ? payload.warnings[0]
            : `Job ${payload.jobId.slice(0, 8)} queued`,
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
          if (!value || typeof value !== 'object') return 'Running bench...';
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
          const groupName = activeGroups.find((group) => group.id === groupId)
            ?.name ?? 'Group';
          const scenarioName = scenarios.find((scenario) =>
            scenario.id === scenarioId
          )?.name ?? 'Scenario';
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
            setRunMessage(snapshot.error ?? 'Bench job failed');
          } else if (snapshot.status === 'cancelled') {
            setStatus('cancelled');
            setRunMessage('Bench job cancelled');
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
          setHistoryItems((current) => {
            const entry = createBenchHistoryEntry(
              nextReport,
              env,
              activeGroups,
              scenarios,
              settings,
            );
            const next = upsertBenchHistoryEntry(current, entry);
            persistBenchHistory(next);
            return next;
          });
          setStatus(nextReport.status ?? 'complete');
          setProgress(100);
          setRunMessage(
            nextReport.summary && nextReport.summary.failedRuns > 0
              ? `Complete with ${
                pluralize(nextReport.summary.failedRuns, 'failed run')
              }`
              : 'Bench complete',
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
            setRunMessage('Reconnecting bench stream...');
            return;
          }
          setStatus('failed');
          setRunMessage(message ?? 'Bench stream disconnected');
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
    activeGroups,
    benchRunBlockers.length,
    clearActiveJobConnection,
    env,
    loadBenchHealth,
    providerConfigured,
    runCount,
    scenarios,
    settings,
  ]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    const copied = await copyToClipboard(JSON.stringify(report, null, 2));
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
    clearActiveJobConnection();
    setEnv((current) => ({
      apiKey: current.apiKey,
      baseURL: entry.config.env.baseURL,
      model: entry.config.env.model,
    }));
    setGroups(cloneBenchGroups(entry.config.groups));
    setScenarios(cloneBenchScenarios(entry.config.scenarios));
    setSettings(cloneBenchSettings(entry.config.settings));
    setReport(entry.report);
    setStatus(entry.report.status ?? 'complete');
    setProgress(100);
    setRunMessage(
      entry.report.summary && entry.report.summary.failedRuns > 0
        ? `Loaded history · ${
          pluralize(entry.report.summary.failedRuns, 'failed run')
        }`
        : 'Loaded history',
    );
    setHistoryOpen(false);
  }, [clearActiveJobConnection]);

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

  const baseline = useMemo(() => {
    if (!report) return null;
    return report.summaries.find((item) => item.role === 'control')
      ?? report.summaries[0]
      ?? null;
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
    return [...report.summaries].sort(
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
            title='Bench'
            description='Compare A2UI model, prompt, and catalog variants across fixed generation scenarios.'
            topContent={
              <>
                <span className='chip'>{activeGroups.length} groups</span>
                <span className='chip'>{scenarios.length} scenarios</span>
                <span className='chip'>{pluralize(runCount, 'run')}</span>
              </>
            }
          />
        )
        : <h1 className='benchPageAccessibleTitle'>Bench Runner</h1>}

      <div
        className='benchBody'
        data-report-resizing={isResizingReport}
        ref={benchBodyRef}
        style={benchBodyStyle}
      >
        <main className='benchMain' aria-label='Bench workspace'>
          <section className='benchOverviewBand'>
            <div className='benchOverviewCopy'>
              <div className='benchEyebrow'>A2UI v0.9 bench plan</div>
              <h2 className='benchOverviewTitle'>
                Model, prompt, and catalog comparisons in one matrix.
              </h2>
            </div>
            <div className='benchMetricStrip'>
              <div className='benchMetric'>
                <span className='benchMetricLabel'>Agent</span>
                <strong>
                  {report && report.summaries.length > 0
                    ? formatMs(average(
                      report.summaries.map((item) => item.avgAgentMs),
                    ))
                    : 'n/a'}
                </strong>
              </div>
              <div className='benchMetric'>
                <span className='benchMetricLabel'>Tokens</span>
                <strong>
                  {report && report.summaries.length > 0
                    ? formatNumber(average(
                      report.summaries.map((item) => item.avgTokens),
                    ))
                    : 'n/a'}
                </strong>
              </div>
              <div className='benchMetric'>
                <span className='benchMetricLabel'>Judge</span>
                <strong>{formatReportJudgeMetric(report)}</strong>
              </div>
            </div>
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
                  onClick={() => setConfigOpen(true)}
                >
                  Configure
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  iconOnly
                  iconBefore={RotateCcw}
                  aria-label='Reset bench'
                  title='Reset bench'
                  onClick={resetBench}
                />
              </div>
              <div className='benchProgressTrack' aria-hidden='true'>
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
              >
                {getRunMetaText(status, progress, runMessage, runCount)}
              </div>
            </div>
            <div className='benchPlanSummary'>
              <div className='benchPlanItem'>
                <span>Provider</span>
                <strong>{getProviderPlanLabel(env, providerConfigured)}</strong>
                <small>{getProviderPlanMeta(env, providerConfigured)}</small>
              </div>
              <div className='benchPlanItem'>
                <span>Runner</span>
                <strong>
                  {settings.repeats}x / {settings.parallelism} parallel
                </strong>
                <small>
                  {settings.judgeEnabled ? 'judge on' : 'judge off'} ·{' '}
                  {settings.repairEnabled ? 'repair on' : 'repair off'}
                </small>
              </div>
              <div className='benchPlanItem'>
                <span>Scenarios</span>
                <strong>{scenarios.length} prompts</strong>
                <small>{activeScenarioTypes.join(' / ')}</small>
              </div>
            </div>
          </section>

          <section className='benchGroupsSection'>
            <div className='benchSectionHeader benchGroupsHeader'>
              <div>
                <h3 className='benchSectionTitle'>Groups</h3>
                <p className='benchSectionSub'>Controls and experiments</p>
              </div>
              <div className='benchHeaderActions'>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={MessageSquarePlus}
                  onClick={() => addGroup('control')}
                >
                  Control
                </Button>
                <Button
                  variant='secondary'
                  size='sm'
                  iconBefore={Sparkles}
                  onClick={() => addGroup('experiment')}
                >
                  Experiment
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
                          key={role}
                          onClick={() =>
                            updateGroup(group.id, groupPatch('role', role))}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant='danger'
                      size='sm'
                      iconOnly
                      iconBefore={Trash2}
                      aria-label={`Remove ${group.name}`}
                      title={`Remove ${group.name}`}
                      disabled={groups.length <= 1}
                      onClick={() => removeGroup(group.id)}
                    />
                  </div>
                  <input
                    className='benchGroupName'
                    value={group.name}
                    aria-label='Group name'
                    onChange={(event) =>
                      updateGroup(
                        group.id,
                        groupPatch('name', event.target.value),
                      )}
                  />
                  <div className='benchGroupSummary'>
                    <span>{group.variable}</span>
                    <span>{group.catalog}</span>
                    <span>{group.model || env.model}</span>
                  </div>
                  <details className='benchGroupDetails'>
                    <summary>Configure</summary>
                    <div className='benchGroupFields'>
                      <label className='benchField'>
                        <span className='benchFieldLabel'>Variable</span>
                        <select
                          className='benchSelect'
                          value={group.variable}
                          onChange={(event) =>
                            updateGroup(
                              group.id,
                              groupPatch(
                                'variable',
                                event.target.value as BenchVariable,
                              ),
                            )}
                        >
                          <option value='model'>Model</option>
                          <option value='prompt'>Prompt</option>
                          <option value='catalog'>Catalog</option>
                          <option value='custom'>Custom</option>
                        </select>
                      </label>
                      <label className='benchField'>
                        <span className='benchFieldLabel'>Catalog</span>
                        <select
                          className='benchSelect'
                          value={group.catalog}
                          onChange={(event) =>
                            updateGroup(
                              group.id,
                              groupPatch('catalog', event.target.value),
                            )}
                        >
                          {CATALOG_OPTIONS.map((catalog) => (
                            <option key={catalog} value={catalog}>
                              {catalog}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className='benchField'>
                      <span className='benchFieldLabel'>Model override</span>
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
                    <label className='benchField'>
                      <span className='benchFieldLabel'>Extra instruction</span>
                      <textarea
                        className='benchTextarea'
                        value={group.extraInstruction}
                        placeholder='Additional system instruction for this group'
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

          <section className='benchPlanSection'>
            <div className='benchSectionHeader'>
              <div>
                <h3 className='benchSectionTitle'>Plan</h3>
                <p className='benchSectionSub'>
                  {pluralize(activeGroups.length, 'group')} ·{' '}
                  {pluralize(scenarios.length, 'scenario')} ·{' '}
                  {pluralize(settings.repeats, 'repeat')}
                </p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                iconBefore={Zap}
                onClick={() => setConfigOpen(true)}
              >
                Edit
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
          aria-label='Resize report panel'
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

        <aside className='benchReportPane' aria-label='Bench report'>
          <div className='benchReportHeader'>
            <div>
              <h3 className='benchSectionTitle'>Report</h3>
              <p className='benchSectionSub'>
                {report
                  ? new Date(report.createdAt).toLocaleString()
                  : 'No report'}
              </p>
            </div>
            <div className='benchReportActions'>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={History}
                onClick={() => setHistoryOpen(true)}
              >
                History
              </Button>
              <Button
                variant='secondary'
                size='sm'
                iconBefore={Copy}
                disabled={!report}
                onClick={() => void copyReport()}
              >
                {copyState === 'copied' ? 'Copied' : 'JSON'}
              </Button>
            </div>
          </div>

          {report && baseline
            ? (
              <>
                <div className='benchInsightGrid'>
                  <div className='benchInsight'>
                    <span>Lowest tokens</span>
                    <strong>{bestTokens?.groupName ?? 'n/a'}</strong>
                    <small>
                      {bestTokens
                        ? formatNumber(bestTokens.avgTokens)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>Fastest agent</span>
                    <strong>{fastestAgent?.groupName ?? 'n/a'}</strong>
                    <small>
                      {fastestAgent
                        ? formatMs(fastestAgent.avgAgentMs)
                        : 'n/a'}
                    </small>
                  </div>
                  <div className='benchInsight'>
                    <span>Best judge</span>
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
                        <th>Group</th>
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
                      {report.summaries.map((summary) => (
                        <tr key={summary.groupId}>
                          <td>
                            <div className='benchTableGroup'>
                              <span
                                className={`benchRoleDot ${summary.role}`}
                              />
                              <span>{summary.groupName}</span>
                            </div>
                          </td>
                          <td>
                            <strong>{formatNumber(summary.avgTokens)}</strong>
                            <small>
                              {deltaText(
                                summary.avgTokens,
                                baseline.avgTokens,
                              )}
                            </small>
                          </td>
                          <td>
                            <strong>{formatMs(summary.avgAgentMs)}</strong>
                            <small>
                              {deltaText(
                                summary.avgAgentMs,
                                baseline.avgAgentMs,
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
                              settings,
                              summary,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <section className='benchScreenshotSection'>
                  <div className='benchSectionHeader'>
                    <div>
                      <h3 className='benchSectionTitle'>Screenshots</h3>
                      <p className='benchSectionSub'>
                        Complete run matrix with failed slots preserved
                      </p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={Maximize2}
                      disabled={screenshotMatrix.total === 0}
                      onClick={() => setScreenshotsOpen(true)}
                    >
                      Open
                    </Button>
                  </div>
                  <div className='benchScreenshotSummaryGrid'>
                    <div>
                      <span>Runs</span>
                      <strong>{formatNumber(screenshotMatrix.total)}</strong>
                    </div>
                    <div>
                      <span>Captured</span>
                      <strong>
                        {formatNumber(screenshotMatrix.captured)}
                      </strong>
                    </div>
                    <div>
                      <span>Failed</span>
                      <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                    </div>
                    <div>
                      <span>Missing</span>
                      <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                    </div>
                  </div>
                </section>

                <div className='benchReportNotes'>
                  <a
                    href='https://lynxjs.org/zh/react/genui/a2ui.html'
                    target='_blank'
                    rel='noreferrer'
                    className='benchDocLink'
                  >
                    A2UI docs
                    <ArrowUpRight size={13} strokeWidth={2} />
                  </a>
                  <span>
                    Agent, Tokens, Attempts, and validation are measured by the
                    server. Render and judge are marked when unavailable.
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
                <strong>Ready for benchmark data</strong>
                <span>Run the matrix to produce a report.</span>
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
                    Screenshots
                  </h2>
                  <p className='benchConfigSub'>
                    {pluralize(screenshotMatrix.rows.length, 'group')} ×{' '}
                    {pluralize(screenshotMatrix.scenarios.length, 'scenario')}
                    {' · '}
                    {pluralize(screenshotMatrix.repeatCount, 'repeat')}
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label='Close screenshots'
                  title='Close screenshots'
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
                    <span>Captured</span>
                    <strong>{formatNumber(screenshotMatrix.captured)}</strong>
                  </div>
                  <div>
                    <span>Failed</span>
                    <strong>{formatNumber(screenshotMatrix.failed)}</strong>
                  </div>
                  <div>
                    <span>Missing</span>
                    <strong>{formatNumber(screenshotMatrix.missing)}</strong>
                  </div>
                </div>

                <div className='benchScreenshotMatrixWrap'>
                  <div
                    className='benchScreenshotMatrix'
                    style={screenshotMatrixStyle}
                  >
                    <div className='benchScreenshotMatrixCorner'>Group</div>
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
                              {row.group.variable}
                              {' · '}
                              {row.group.catalog}
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
                                              settings,
                                              item,
                                            )}
                                          </span>
                                          <span>{formatMs(item.agentMs)}</span>
                                          <span>
                                            {formatNumber(item.tokens)} tokens
                                          </span>
                                        </>
                                      )
                                      : <span>No result</span>}
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
                  Done
                </Button>
              </footer>
              <div
                className='benchScreenshotResizeHandle'
                role='separator'
                aria-label='Resize screenshots dialog'
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
                    Bench history
                  </h2>
                  <p className='benchConfigSub'>
                    {historyItems.length > 0
                      ? `${pluralize(historyItems.length, 'saved run')}`
                      : 'No saved runs yet'}
                  </p>
                </div>
                <Button
                  variant='secondary'
                  size='sm'
                  iconOnly
                  iconBefore={X}
                  aria-label='Close bench history'
                  title='Close bench history'
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
                                  ? pluralize(failedRuns, 'failed run')
                                  : 'passed'}
                              </span>
                            </div>

                            <div className='benchHistoryStats'>
                              <div>
                                <span>Runs</span>
                                <strong>{formatNumber(totalRuns)}</strong>
                              </div>
                              <div>
                                <span>Success</span>
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
                                  ? 'key was set'
                                  : 'no key'}
                              </span>
                              <span>
                                {pluralize(
                                  entry.config.settings.repeats,
                                  'repeat',
                                )} / {entry.config.settings.parallelism}{' '}
                                parallel
                              </span>
                              <span>
                                {pluralize(entry.config.groups.length, 'group')}
                                {' · '}
                                {pluralize(
                                  entry.config.scenarios.length,
                                  'scenario',
                                )}
                              </span>
                              {jobId
                                ? <span>job {jobId.slice(0, 8)}</span>
                                : null}
                            </div>

                            <details className='benchHistoryDetails'>
                              <summary>Configuration snapshot</summary>
                              <div className='benchHistorySnapshot'>
                                <div>
                                  <span>Base URL</span>
                                  <strong>{entry.config.env.baseURL}</strong>
                                </div>
                                {jobId
                                  ? (
                                    <div>
                                      <span>a2uiBenchJobId</span>
                                      <strong>{jobId}</strong>
                                    </div>
                                  )
                                  : null}
                                {recoveryUrl
                                  ? (
                                    <div>
                                      <span>Recovery URL</span>
                                      <strong>{recoveryUrl}</strong>
                                    </div>
                                  )
                                  : null}
                                <div>
                                  <span>Groups</span>
                                  <strong>
                                    {entry.config.groups.map((group) =>
                                      `${group.name} (${group.model})`
                                    ).join(', ')}
                                  </strong>
                                </div>
                                <div>
                                  <span>Scenarios</span>
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
                                Restore
                              </Button>
                              <Button
                                variant='secondary'
                                size='sm'
                                iconBefore={Copy}
                                disabled={!jobId}
                                onClick={() =>
                                  void copyHistoryRecoveryUrl(entry)}
                              >
                                {historyCopyId === entry.id
                                  ? 'Copied'
                                  : 'Copy URL'}
                              </Button>
                              <Button
                                variant='secondary'
                                size='sm'
                                iconBefore={Trash2}
                                onClick={() => deleteHistoryEntry(entry.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )
                  : (
                    <div className='benchEmptyReport benchHistoryEmpty'>
                      <History size={28} strokeWidth={1.8} />
                      <strong>No history yet</strong>
                      <span>Completed bench runs will be saved here.</span>
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
                  Clear history
                </Button>
                <Button
                  variant='primary'
                  size='sm'
                  onClick={() => setHistoryOpen(false)}
                >
                  Done
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
                        ? 'Bench needs configuration'
                        : 'Run with server defaults?'}
                    </h2>
                    <p id='bench-run-notice-desc' className='benchConfigSub'>
                      {benchRunBlockers.length > 0
                        ? 'Complete the required setup before starting a run.'
                        : 'No custom provider configuration was detected.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label='Close bench notice'
                  title='Close bench notice'
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
                        This bench will not send OPENAI_API_KEY,
                        OPENAI_BASE_URL, or OPENAI_MODEL from the browser. The
                        server will use its `/a2ui/health` defaults.
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
                            {benchHealth?.model ?? 'Server default'}
                          </strong>
                        </div>
                        <div>
                          <span>Base URL</span>
                          <strong>
                            {benchHealth?.baseURL ?? 'Server default'}
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
                  Close
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
                  Configure
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
                      Run with defaults
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
                    Bench configuration
                  </h2>
                  <p className='benchConfigSub'>
                    Provider, runner, and scenario inputs.
                  </p>
                </div>
                <Button
                  variant='ghost'
                  size='md'
                  iconOnly
                  iconBefore={X}
                  aria-label='Close bench configuration'
                  title='Close bench configuration'
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
                        {env.apiKey.trim() ? 'Key set' : 'No key'}
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
                      <span className='benchFieldLabel'>OPENAI_MODEL</span>
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
                        <h3 className='benchSectionTitle'>Runner</h3>
                        <p className='benchSectionSub'>
                          Repeats, parallelism, and checks
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
                        <span className='benchFieldLabel'>Parallel</span>
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
                      <span>Repair attempts</span>
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
                      <span>ui-judge score</span>
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
                      <span>Live render metrics</span>
                    </label>
                  </section>
                </div>

                <section className='benchConfigSection benchConfigScenarios'>
                  <div className='benchSectionHeader'>
                    <div>
                      <h3 className='benchSectionTitle'>Scenarios</h3>
                      <p className='benchSectionSub'>Prompt suite</p>
                    </div>
                    <Button
                      variant='secondary'
                      size='sm'
                      iconBefore={MessageSquarePlus}
                      onClick={addScenario}
                    >
                      Add
                    </Button>
                  </div>
                  <div className='benchScenarioList'>
                    {scenarios.map((scenario) => (
                      <div className='benchScenarioItem' key={scenario.id}>
                        <div className='benchScenarioTop'>
                          <input
                            className='benchInlineInput benchScenarioName'
                            value={scenario.name}
                            aria-label='Scenario name'
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
                            aria-label={`Remove ${scenario.name}`}
                            title={`Remove ${scenario.name}`}
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
                  Reset
                </Button>
                <Button
                  variant='primary'
                  size='md'
                  onClick={() => setConfigOpen(false)}
                >
                  Done
                </Button>
              </footer>
            </section>
          </div>
        )
        : null}
    </div>
  );
}
