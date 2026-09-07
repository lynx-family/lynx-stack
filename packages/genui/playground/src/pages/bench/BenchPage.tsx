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

import { BenchComparisonGroupsSection } from './BenchComparisonGroupsSection.js';
import {
  BENCH_CATALOG_OPTIONS,
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createCustomBenchScenario,
  createDefaultBenchGroups,
  findComparableBaseline,
  inferBenchVariable,
  usesCatalog,
} from './benchData.js';
import type {
  BenchComparisonDirection,
  BenchGroup,
  BenchProfile,
  BenchProtocol,
  BenchRole,
  BenchScenario,
  BenchSettings,
  BenchVariable,
} from './benchData.js';
import { BenchHistoryRail } from './BenchHistoryRail.js';
import { BenchReportPanel } from './BenchReportPanel.js';
import type { BenchReport, BenchStatus } from './benchReportTypes.js';
import { BenchRunFooter } from './BenchRunFooter.js';
import { BenchRunNotice } from './BenchRunNotice.js';
import { BenchRunPanel } from './BenchRunPanel.js';
import { BenchScenarioSection } from './BenchScenarioSection.js';
import { BenchScreenshotsDialog } from './BenchScreenshotsDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { PanelResizeHandle } from '../../components/PanelResizeHandle.js';
import {
  GENUI_SERVER_URL,
  buildGenuiServerUrl,
} from '../../config/genuiServer.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { isDevHost } from '../../utils/publishPayload.js';
import {
  createChatHost,
  createDefaultProviderSettings,
  loadProviderSettings,
} from '../chat/shared.js';
import type { ProviderSettings } from '../chat/shared.js';

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
  | { code: 'raw'; text: string }
  | { code: 'ready' }
  | { code: 'reconnecting' }
  | { code: 'report-load-failed'; status: number }
  | { code: 'report-loaded'; failedRuns?: number }
  | {
    code: 'run-progress';
    group?: Pick<BenchGroup, 'name'>;
    phase: string;
    repeatIndex: number;
    scenario?: Pick<BenchScenario, 'name'>;
  }
  | { code: 'run-config-required' }
  | { code: 'running' }
  | { code: 'setup-restored-loading-report' }
  | { code: 'setup-restored-report-unavailable' }
  | { code: 'stopping-previous-job' }
  | { code: 'stream-disconnected' };

export function getBenchRunMessageText(
  message: BenchRunMessage,
): string {
  switch (message.code) {
    case 'bench-cancelled':
      return 'Bench paused';
    case 'bench-complete':
      return message.failedRuns
        ? `Bench complete · ${message.failedRuns} failed runs`
        : 'Bench complete';
    case 'bench-failed':
      return 'Bench job failed';
    case 'bench-request-failed':
      return `Bench request failed: ${message.status}`;
    case 'cancellation-failed':
      return `Job ${message.jobId} was not cancelled. Reset again to retry.`;
    case 'complete-report-loaded':
      return 'Complete report loaded';
    case 'creating-job':
      return 'Creating Bench job…';
    case 'defaults-confirmation-required':
      return 'Confirm that you want to use the server defaults';
    case 'history-report-loaded':
      return message.failedRuns
        ? `Saved report loaded · ${message.failedRuns} failed runs`
        : 'Saved report loaded';
    case 'job-queued':
      return `Job ${message.jobId} queued`;
    case 'loading-report':
      return `Loading report ${message.jobId}…`;
    case 'raw':
      return message.text;
    case 'ready':
      return 'Ready';
    case 'reconnecting':
      return 'Reconnecting to the Bench event stream…';
    case 'report-load-failed':
      return `Failed to load report: ${message.status}`;
    case 'report-loaded':
      return message.failedRuns
        ? `Report loaded · ${message.failedRuns} failed runs`
        : 'Report loaded';
    case 'run-config-required':
      return 'Complete the run setup first';
    case 'run-progress': {
      const groupName = message.group?.name ?? 'Comparison group';
      const scenarioName = message.scenario?.name ?? 'Scenario';
      return `${groupName} · ${scenarioName} · #${message.repeatIndex} · ${message.phase}`;
    }
    case 'running':
      return 'Bench running…';
    case 'setup-restored-loading-report':
      return 'Setup restored. Loading the complete report…';
    case 'setup-restored-report-unavailable':
      return 'Setup restored · Complete report unavailable';
    case 'stopping-previous-job':
      return 'Stopping the previous Bench job…';
    case 'stream-disconnected':
      return 'Bench event stream disconnected';
  }
}

type BenchEnv = ProviderSettings;

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
  report: BenchReport | null;
  config: BenchHistoryConfig;
}

type BenchReportSettingsPayload = Partial<BenchSettings> & {
  renderMetricsEnabled?: boolean;
};

const DEFAULT_ENV: Readonly<BenchEnv> = createDefaultProviderSettings();

const REPORT_PANE_DEFAULT_WIDTH = 440;
const REPORT_PANE_MIN_WIDTH = 360;
const REPORT_PANE_MAX_WIDTH = 640;
const MAIN_PANE_MIN_WIDTH = 620;
const HISTORY_RAIL_WIDTH = 240;
const RESIZE_HANDLE_WIDTH = 10;
const REPORT_PANE_RESIZE_BREAKPOINT = 1240;
const REPORT_PANE_WIDTH_STORAGE_KEY = 'a2ui-bench-report-width';
const EVENT_SOURCE_CLOSED_READY_STATE = 2;
const BENCH_HISTORY_STORAGE_KEY = 'a2ui-bench-history';
const LOCAL_A2UI_SERVER_PORT = '3060';
const UI_JUDGE_SERVER_URL_STORAGE_KEY = 'genui-bench-ui-judge-server-url';

export function readBenchUiJudgeServerUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(UI_JUDGE_SERVER_URL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function normalizeBenchUiJudgeServerUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
    ) {
      return null;
    }
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
    return url.toString();
  } catch {
    return null;
  }
}

function getSelectedBenchModel(
  env: Pick<BenchEnv, 'models' | 'provider'>,
): string {
  return env.models.find((model) => model.id === env.provider)?.id
    ?? env.models[0]?.id
    ?? '';
}

function reconcileBenchGroupModels(
  groups: BenchGroup[],
  env: BenchEnv,
): BenchGroup[] {
  const selectedModel = getSelectedBenchModel(env);
  if (!selectedModel) return groups;
  return groups.map((group) =>
    env.models.some((model) => model.id === group.model)
      ? group
      : { ...group, model: selectedModel }
  );
}

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
    ? containerWidth - HISTORY_RAIL_WIDTH - MAIN_PANE_MIN_WIDTH
      - RESIZE_HANDLE_WIDTH
    : REPORT_PANE_MAX_WIDTH;
  const max = Math.min(
    REPORT_PANE_MAX_WIDTH,
    Math.max(REPORT_PANE_MIN_WIDTH, maxByContainer),
  );
  return clampNumber(value, REPORT_PANE_MIN_WIDTH, max);
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

function isProviderConfigured(env: BenchEnv): boolean {
  return env.status === 'ready' && env.models.length > 0;
}

function cloneBenchGroups(groups: readonly BenchGroup[]): BenchGroup[] {
  return groups.map((group) => ({ ...group }));
}

function cloneBenchScenarios(
  scenarios: readonly BenchScenario[],
): BenchScenario[] {
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

function cloneBenchSettings(settings: Readonly<BenchSettings>): BenchSettings {
  return { ...settings };
}

function createBenchPlanSignature(
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  settings: BenchSettings,
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
    repeats: readFiniteNumber(
      reportSettings.repeats,
      DEFAULT_BENCH_SETTINGS.repeats,
    ),
    parallelism: readFiniteNumber(
      reportSettings.parallelism,
      DEFAULT_BENCH_SETTINGS.parallelism,
    ),
    repairEnabled: readBoolean(
      reportSettings.repairEnabled,
      DEFAULT_BENCH_SETTINGS.repairEnabled,
    ),
    judgeEnabled: readBoolean(
      reportSettings.judgeEnabled,
      DEFAULT_BENCH_SETTINGS.judgeEnabled,
    ),
    collectLiveRenderMetrics: readBoolean(
      reportSettings.collectLiveRenderMetrics,
      readBoolean(
        reportSettings.renderMetricsEnabled,
        DEFAULT_BENCH_SETTINGS.collectLiveRenderMetrics,
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
  return groups.length > 0 ? groups : createDefaultBenchGroups(fallbackModel);
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
    : cloneBenchScenarios(DEFAULT_BENCH_SCENARIOS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBenchHistoryEntry(value: unknown): value is BenchHistoryEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  if (value.report !== null && !isRecord(value.report)) return false;
  if (!isRecord(value.config)) return false;
  const reportIsValid = value.report === null
    || (Array.isArray(value.report.summaries)
      && Array.isArray(value.report.results));
  return reportIsValid
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
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  settings: BenchSettings,
  id = createId('bench-history'),
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
    id,
    title: `${protocols.join(' + ')} · ${totalRuns} Runs`,
    savedAt: new Date().toISOString(),
    report: sanitizeBenchReportValue(report) as BenchReport,
    config: {
      env: {
        apiKeyConfigured: report.env.apiKeyConfigured,
        model: groups[0]?.model ?? report.env.model,
      },
      settings: cloneBenchSettings(settings),
      groups: cloneBenchGroups(groups),
      scenarios: cloneBenchScenarios(scenarios),
    },
  };
}

function createBenchDraftHistoryEntry(
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  settings: BenchSettings,
): BenchHistoryEntry {
  return {
    id: createId('bench-draft'),
    title: 'New Bench',
    savedAt: new Date().toISOString(),
    report: null,
    config: {
      env: {
        apiKeyConfigured: false,
        model: groups[0]?.model ?? '',
      },
      groups: cloneBenchGroups(groups),
      scenarios: cloneBenchScenarios(scenarios),
      settings: cloneBenchSettings(settings),
    },
  };
}

function createBenchHistoryEntryFromReport(
  report: BenchReport,
): BenchHistoryEntry {
  return createBenchHistoryEntry(
    report,
    createBenchGroupsFromReport(report),
    createBenchScenariosFromReport(report),
    createBenchSettingsFromReport(report),
  );
}

export function upsertBenchHistoryEntry(
  entries: BenchHistoryEntry[],
  entry: BenchHistoryEntry,
): BenchHistoryEntry[] {
  const reportIdentity = entry.report?.jobId ?? entry.report?.id;
  const next = entries.filter((item) => {
    const itemReportIdentity = item.report?.jobId ?? item.report?.id;
    const sameReport = Boolean(reportIdentity)
      && itemReportIdentity === reportIdentity;
    return item.id !== entry.id && !sameReport;
  });
  return [entry, ...next];
}

export function saveBenchHistoryEntry(
  entries: BenchHistoryEntry[],
  entry: BenchHistoryEntry,
): BenchHistoryEntry[] {
  return [entry, ...entries.filter((item) => item.id !== entry.id)];
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
    const safeReport = entry.report
      ? sanitizeBenchReportValue(entry.report) as BenchReport
      : null;
    const configReport = {
      ...(safeReport ?? {
        env: entry.config.env,
        results: [],
        summaries: [],
      }),
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
  });
}

export function serializeBenchHistoryEntries(
  entries: BenchHistoryEntry[],
): string {
  const persistableEntries = entries.map(
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

function groupPatch<K extends keyof BenchGroup>(
  key: K,
  value: BenchGroup[K],
): Pick<BenchGroup, K> {
  return { [key]: value } as Pick<BenchGroup, K>;
}

export function updateBenchGroupById(
  groups: readonly BenchGroup[],
  id: string,
  patch: Partial<BenchGroup>,
): BenchGroup[] {
  return groups.map((group) =>
    group.id === id ? { ...group, ...patch } : group
  );
}

export function getBenchRunBlockers(
  activeGroupCount: number,
  enabledControlCount: number,
  scenarioCount: number,
  repeats: number,
): string[] {
  const issues: string[] = [];
  if (activeGroupCount === 0) {
    issues.push(
      'Enable at least one comparison group.',
    );
  } else if (enabledControlCount === 0) {
    issues.push(
      'Enable at least one baseline group.',
    );
  }
  if (scenarioCount === 0) {
    issues.push(
      'Add at least one scenario.',
    );
  }
  if (repeats < 1) {
    issues.push(
      'Repeats must be at least 1.',
    );
  }
  return issues;
}

export function BenchPage() {
  const [env, setEnv] = useState<BenchEnv>(createDefaultProviderSettings);
  const [uiJudgeServerUrl, setUiJudgeServerUrl] = useState(
    readBenchUiJudgeServerUrl,
  );
  const [groups, setGroups] = useState<BenchGroup[]>(() =>
    createDefaultBenchGroups(DEFAULT_ENV.model)
  );
  const [scenarios, setScenarios] = useState<BenchScenario[]>(
    () => cloneBenchScenarios(DEFAULT_BENCH_SCENARIOS),
  );
  const [settings, setSettings] = useState<BenchSettings>(
    () => cloneBenchSettings(DEFAULT_BENCH_SETTINGS),
  );
  const [status, setStatus] = useState<BenchStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [runMessage, setRunMessage] = useState<BenchRunMessage>({
    code: 'ready',
  });
  const [benchRunNoticeOpen, setBenchRunNoticeOpen] = useState(false);
  const [benchHealth, setBenchHealth] = useState<BenchHealth | null>(null);
  const [benchHealthError, setBenchHealthError] = useState<
    BenchHealthError | null
  >(null);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [reportPaneWidth, setReportPaneWidth] = useState(
    getInitialReportPaneWidth,
  );
  const [isResizingReport, setIsResizingReport] = useState(false);
  const [report, setReport] = useState<BenchReport | null>(null);
  const [reportPlanSignature, setReportPlanSignature] = useState<string | null>(
    null,
  );
  const [historyItems, setHistoryItems] = useState<BenchHistoryEntry[]>(
    readBenchHistory,
  );
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [historyCopyId, setHistoryCopyId] = useState<string | null>(null);
  const benchBodyRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const eventSourceRef = useRef<EventSource | null>(null);
  const historyReportAbortRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const pendingCancellationJobIdsRef = useRef<Set<string>>(new Set());
  const benchOperationIdRef = useRef(0);
  const initialEnvRef = useRef(env);
  const initialHistoryRestoredRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadProviderSettings(
      initialEnvRef.current,
      createChatHost(window.location),
      controller.signal,
    ).then(
      (next) => {
        if (controller.signal.aborted) return;
        setEnv(next);
        setGroups((current) => reconcileBenchGroupModels(current, next));
      },
      () => {
        // Abort-driven rejections are expected when Bench unmounts.
      },
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const normalized = normalizeBenchUiJudgeServerUrl(uiJudgeServerUrl);
    if (normalized === null) return;
    try {
      if (normalized) {
        window.localStorage.setItem(
          UI_JUDGE_SERVER_URL_STORAGE_KEY,
          normalized,
        );
      } else {
        window.localStorage.removeItem(UI_JUDGE_SERVER_URL_STORAGE_KEY);
      }
    } catch {
      // The field remains usable when localStorage is unavailable.
    }
  }, [uiJudgeServerUrl]);

  useEffect(() => {
    persistBenchHistory(historyItems);
  }, [historyItems]);

  useEffect(() => {
    if (!activeHistoryId) return;
    setHistoryItems((current) => {
      const activeEntry = current.find((entry) => entry.id === activeHistoryId);
      if (!activeEntry || activeEntry.report) return current;
      const next = current.map((entry) =>
        entry.id === activeHistoryId
          ? {
            ...entry,
            config: {
              env: {
                apiKeyConfigured: false,
                model: groups[0]?.model ?? '',
              },
              groups: cloneBenchGroups(groups),
              scenarios: cloneBenchScenarios(scenarios),
              settings: cloneBenchSettings(settings),
            },
          }
          : entry
      );
      return next;
    });
  }, [activeHistoryId, groups, scenarios, settings]);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.enabled),
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
  const runCount = activeGroups.length * scenarios.length * settings.repeats;
  const activeHistoryEntry = historyItems.find((entry) =>
    entry.id === activeHistoryId
  );
  const historyReadOnly = activeHistoryEntry?.report !== null
    && activeHistoryEntry?.report !== undefined;
  const historyLocked = status === 'running';
  const planLocked = historyLocked || historyReadOnly;
  const planSignature = useMemo(
    () => createBenchPlanSignature(runGroups, scenarios, settings),
    [runGroups, scenarios, settings],
  );
  const reportIsStale = Boolean(
    report && reportPlanSignature !== planSignature,
  );
  const reportSettings = useMemo(
    () => report ? createBenchSettingsFromReport(report) : settings,
    [report, settings],
  );
  const selectedModel = getSelectedBenchModel(env);
  const modelValidationError = useMemo(() => {
    if (env.status === 'idle' || env.status === 'loading') {
      return 'The server model list is still loading.';
    }
    if (env.status === 'error') {
      return env.error
        ?? 'Failed to load the server model list.';
    }
    if (env.models.length === 0) {
      return 'Configure at least one server model before running Bench.';
    }
    if (
      activeGroups.some((group) =>
        !env.models.some((model) => model.id === group.model)
      )
    ) {
      return 'Select a server model for every enabled comparison group.';
    }
    return undefined;
  }, [activeGroups, env]);
  const uiJudgeServerUrlValidationError = useMemo(
    () =>
      normalizeBenchUiJudgeServerUrl(uiJudgeServerUrl) === null
        ? 'UI_JUDGE_SERVER_URL must be an HTTP(S) URL without credentials.'
        : undefined,
    [uiJudgeServerUrl],
  );
  const providerConfigured = useMemo(
    () => isProviderConfigured(env),
    [env],
  );
  const benchRunBlockers = useMemo(
    () => [
      ...getBenchRunBlockers(
        activeGroups.length,
        enabledControlGroupCount,
        scenarios.length,
        settings.repeats,
      ),
      ...(modelValidationError ? [modelValidationError] : []),
      ...(uiJudgeServerUrlValidationError
        ? [uiJudgeServerUrlValidationError]
        : []),
    ],
    [
      activeGroups.length,
      enabledControlGroupCount,
      modelValidationError,
      scenarios.length,
      settings.repeats,
      uiJudgeServerUrlValidationError,
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
      !benchRunNoticeOpen && !screenshotsOpen
    ) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setBenchRunNoticeOpen(false);
      setScreenshotsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [benchRunNoticeOpen, screenshotsOpen]);

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
        setReport(payload);
        setReportPlanSignature(
          createBenchPlanSignature(
            historyEntry.config.groups,
            historyEntry.config.scenarios,
            historyEntry.config.settings,
          ),
        );
        setGroups(cloneBenchGroups(historyEntry.config.groups));
        setScenarios(cloneBenchScenarios(historyEntry.config.scenarios));
        setSettings(cloneBenchSettings(historyEntry.config.settings));
        setActiveHistoryId(historyEntry.id);
        setHistoryItems((current) => {
          return upsertBenchHistoryEntry(current, historyEntry);
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
      setGroups((current) => updateBenchGroupById(current, id, patch));
    },
    [],
  );

  const addComparisonGroup = useCallback((
    direction: BenchComparisonDirection,
  ) => {
    setGroups((current) => {
      const baseline = current.find((group) => group.role === 'control')
        ?? current[0];
      if (!baseline) return current;

      const model = baseline.model || selectedModel || DEFAULT_ENV.model;
      const nextModel = direction === 'model'
        ? (env.models.find((item) => item.id !== model)?.id ?? model)
        : model;
      const nextGroup: BenchGroup = {
        ...baseline,
        id: createId(`${direction}-comparison`),
        role: 'experiment',
        protocol: direction === 'protocol' ? 'openui' : baseline.protocol,
        profile: direction === 'protocol' ? 'matched-core' : baseline.profile,
        name: `${direction} comparison`,
        variable: direction,
        model: nextModel,
        catalog: direction === 'protocol'
          ? 'Core Catalog'
          : baseline.catalog,
        extraInstruction: direction === 'prompt'
          ? 'Use concise copy and minimize unnecessary UI structure while preserving the requested content and interaction.'
          : baseline.extraInstruction,
        enabled: true,
      };

      if (direction !== 'protocol') return [...current, nextGroup];
      return [
        ...current.map((group) =>
          group.id === baseline.id
            ? {
              ...group,
              protocol: 'a2ui' as const,
              profile: 'matched-core' as const,
              catalog: 'Core Catalog',
            }
            : group
        ),
        nextGroup,
      ];
    });
    if (direction === 'protocol') {
      setSettings((current) => ({ ...current, parallelism: 1 }));
    }
  }, [env.models, selectedModel]);

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
      createCustomBenchScenario(createId('scenario')),
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
    const nextGroups = reconcileBenchGroupModels(
      createDefaultBenchGroups(DEFAULT_ENV.model),
      env,
    );
    const nextScenarios = cloneBenchScenarios(DEFAULT_BENCH_SCENARIOS);
    const nextSettings = cloneBenchSettings(DEFAULT_BENCH_SETTINGS);
    const draft = createBenchDraftHistoryEntry(
      nextGroups,
      nextScenarios,
      nextSettings,
    );
    setGroups(nextGroups);
    setScenarios(nextScenarios);
    setSettings(nextSettings);
    setStatus('idle');
    setProgress(0);
    setRunMessage({ code: 'ready' });
    setReport(null);
    setReportPlanSignature(null);
    setActiveHistoryId(draft.id);
    setHistoryItems((current) => {
      return saveBenchHistoryEntry(current, draft);
    });
    setBenchHealth(null);
    setBenchHealthError(null);
    setBenchRunNoticeOpen(false);
    setScreenshotsOpen(false);
  }, [cancelActiveBenchJob, env]);

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
              ?? 'The server defaults are not ready',
          });
        }
      } catch (error) {
        setBenchHealthError({
          kind: 'raw',
          message: getErrorMessage(error),
        });
      }
    })();
  }, []);

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
        const normalizedUiJudgeServerUrl = normalizeBenchUiJudgeServerUrl(
          uiJudgeServerUrl,
        );
        const response = await window.fetch(jobsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playground: {
              baseUrl: getA2UIPlaygroundBaseUrl(),
              ...(normalizedUiJudgeServerUrl
                ? { uiJudgeServerUrl: normalizedUiJudgeServerUrl }
                : {}),
            },
            provider: {},
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
            createBenchPlanSignature(runGroups, scenarios, settings),
          );
          const entry = createBenchHistoryEntry(
            nextReport,
            runGroups,
            scenarios,
            settings,
            activeHistoryEntry?.report === null
              ? activeHistoryEntry.id
              : undefined,
          );
          setActiveHistoryId(entry.id);
          setHistoryItems((current) => {
            return saveBenchHistoryEntry(current, entry);
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
    activeHistoryEntry,
    benchRunBlockers.length,
    cancelActiveBenchJob,
    cancelBenchJobs,
    loadBenchHealth,
    providerConfigured,
    runCount,
    runGroups,
    scenarios,
    settings,
    uiJudgeServerUrl,
  ]);

  const pauseBench = useCallback(() => {
    if (status !== 'running') return;
    setStatus('cancelled');
    setRunMessage({ code: 'bench-cancelled' });
    void cancelActiveBenchJob().then((cancelled) => {
      if (!cancelled) setStatus('failed');
    });
  }, [cancelActiveBenchJob, status]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    const copied = await copyToClipboard(
      serializeBenchReport(report),
    );
    if (!copied) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1200);
  }, [report]);

  const copyHistoryRecoveryUrl = useCallback(
    async (entry: BenchHistoryEntry) => {
      const jobId = entry.report?.jobId;
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
    setActiveHistoryId(entry.id);
    const restoredSignature = createBenchPlanSignature(
      entry.config.groups,
      entry.config.scenarios,
      entry.config.settings,
    );
    setGroups(
      entry.report
        ? cloneBenchGroups(entry.config.groups)
        : reconcileBenchGroupModels(cloneBenchGroups(entry.config.groups), env),
    );
    setScenarios(cloneBenchScenarios(entry.config.scenarios));
    setSettings(cloneBenchSettings(entry.config.settings));
    if (!entry.report) {
      setReport(null);
      setReportPlanSignature(null);
      setStatus('idle');
      setProgress(0);
      setRunMessage({ code: 'ready' });
      setScreenshotsOpen(false);
      return;
    }
    setReport(entry.report);
    setReportPlanSignature(restoredSignature);
    setStatus(entry.report.status ?? 'complete');
    setProgress(100);
    setRunMessage({
      code: 'history-report-loaded',
      failedRuns: entry.report.summary?.failedRuns,
    });
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

  useEffect(() => {
    if (initialHistoryRestoredRef.current) return;
    initialHistoryRestoredRef.current = true;
    const firstEntry = historyItems[0];
    if (firstEntry) restoreHistoryEntry(firstEntry);
  }, [historyItems, restoreHistoryEntry]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setActiveHistoryId((current) => current === id ? null : current);
    setHistoryItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setActiveHistoryId(null);
    setHistoryItems([]);
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

  const benchBodyStyle = {
    '--bench-report-width': `${reportPaneWidth}px`,
  } as CSSProperties;

  return (
    <div className='benchPage'>
      <PageHeader
        className='benchHeader'
        title='Bench Runner'
        description={'Combine Protocol, Model, Prompt, and Catalog freely, then review the results in one report.'}
      />

      <div
        className='benchBody'
        ref={benchBodyRef}
        style={benchBodyStyle}
      >
        <BenchHistoryRail
          activeId={activeHistoryId}
          copyId={historyCopyId}
          disabled={historyLocked}
          entries={historyItems}
          onClear={clearHistory}
          onCopy={copyHistoryRecoveryUrl}
          onDelete={deleteHistoryEntry}
          onNew={resetBench}
          onRestore={restoreHistoryEntry}
        />
        <main
          className='benchMain'
          aria-label={'Bench workspace'}
        >
          <div className='benchWorkflow'>
            <div className='benchWorkflowScroll'>
              <BenchRunPanel
                locked={planLocked}
                onSettingsChange={(patch) =>
                  setSettings((current) => ({ ...current, ...patch }))}
                onUiJudgeServerUrlChange={setUiJudgeServerUrl}
                settings={settings}
                uiJudgeServerUrl={uiJudgeServerUrl}
                uiJudgeServerUrlValidationError={uiJudgeServerUrlValidationError}
              />

              <BenchScenarioSection
                locked={planLocked}
                onAdd={addScenario}
                onNameChange={(id, name) => updateScenario(id, { name })}
                onPromptChange={(id, prompt) => updateScenario(id, { prompt })}
                onRemove={removeScenario}
                scenarios={scenarios}
              />

              <BenchComparisonGroupsSection
                catalogOptions={BENCH_CATALOG_OPTIONS}
                groups={groups}
                locked={planLocked}
                modelOptions={env.models}
                onAdd={addComparisonGroup}
                onCatalogChange={(id, catalog) =>
                  updateGroup(id, groupPatch('catalog', catalog))}
                onEnabledChange={(id, enabled) =>
                  updateGroup(id, groupPatch('enabled', enabled))}
                onModelChange={(id, model) =>
                  updateGroup(id, groupPatch('model', model))}
                onNameChange={(id, name) => updateGroup(id, { name })}
                onProfileChange={updateGroupProfile}
                onPromptChange={(id, extraInstruction) =>
                  updateGroup(
                    id,
                    groupPatch('extraInstruction', extraInstruction),
                  )}
                onProtocolChange={updateGroupProtocol}
                onRemove={removeGroup}
                onRoleChange={(id, role) =>
                  updateGroup(id, groupPatch('role', role))}
              />
            </div>
            <BenchRunFooter
              groupCount={activeGroups.length}
              messageText={getBenchRunMessageText(runMessage)}
              onAction={status === 'running' ? pauseBench : () => startBench()}
              progress={progress}
              protocols={activeProtocols}
              readOnly={historyReadOnly}
              reportAvailable={report !== null}
              runCount={runCount}
              scenarioCount={scenarios.length}
              status={status}
            />
          </div>
        </main>

        <PanelResizeHandle
          ariaLabel='Resize report panel'
          ariaValueMin={REPORT_PANE_MIN_WIDTH}
          ariaValueMax={REPORT_PANE_MAX_WIDTH}
          ariaValueNow={reportPaneWidth}
          isActive={isResizingReport}
          isCompactLayout={false}
          onKeyDown={nudgeReportWidth}
          onPointerDown={startReportResize}
        />

        <BenchReportPanel
          copyState={copyState}
          onCopy={copyReport}
          onOpenScreenshots={() => setScreenshotsOpen(true)}
          report={report}
          reportIsStale={reportIsStale}
          settings={reportSettings}
        />
      </div>

      <BenchScreenshotsDialog
        onClose={() => setScreenshotsOpen(false)}
        open={screenshotsOpen}
        report={report}
        settings={reportSettings}
      />

      <BenchRunNotice
        blockers={benchRunBlockers}
        health={benchHealth}
        healthError={benchHealthError}
        onClose={() => setBenchRunNoticeOpen(false)}
        onGoToSettings={() => {
          setBenchRunNoticeOpen(false);
          window.requestAnimationFrame(() => {
            document.getElementById('bench-inline-run-config')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          });
        }}
        onRunWithDefaults={() => {
          setBenchRunNoticeOpen(false);
          startBench(true);
        }}
        open={benchRunNoticeOpen}
      />
    </div>
  );
}
