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
    renderMetrics: 'disabled' | 'skipped';
    judge: 'disabled' | 'skipped';
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

function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^100\.(?:6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./u.test(hostname)
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

function readEventData<T>(event: MessageEvent<string>): T | null {
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
  if (report?.capabilities?.judge === 'skipped') return 'skipped';
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
  if (report.capabilities?.judge === 'skipped') return 'skipped';
  if (!settings.judgeEnabled) return 'off';
  return `${summary.avgJudgeScore.toFixed(1)}/5`;
}

function groupPatch<K extends keyof BenchGroup>(
  key: K,
  value: BenchGroup[K],
): Pick<BenchGroup, K> {
  return { [key]: value } as Pick<BenchGroup, K>;
}

export function BenchPage() {
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportPaneWidth, setReportPaneWidth] = useState(
    getInitialReportPaneWidth,
  );
  const [isResizingReport, setIsResizingReport] = useState(false);
  const [report, setReport] = useState<BenchReport | null>(null);
  const [historyItems, setHistoryItems] = useState<BenchHistoryEntry[]>(
    readBenchHistory,
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const benchBodyRef = useRef<HTMLDivElement | null>(null);
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

  const clearActiveJobConnection = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    benchAbortRef.current?.abort();
    benchAbortRef.current = null;
  }, []);

  useEffect(() => clearActiveJobConnection, [clearActiveJobConnection]);

  useEffect(() => {
    if (!configOpen && !historyOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setConfigOpen(false);
      setHistoryOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configOpen, historyOpen]);

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
  }, [clearActiveJobConnection]);

  const startBench = useCallback(() => {
    if (runCount === 0) return;
    clearActiveJobConnection();
    setStatus('running');
    setProgress(0);
    setRunMessage('Creating bench job...');
    setReport(null);

    const controller = new AbortController();
    benchAbortRef.current = controller;

    void (async () => {
      try {
        const jobsEndpoint = getA2UIBenchJobsEndpoint();
        const response = await window.fetch(jobsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: filterProviderForEndpoint(env, jobsEndpoint),
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
            event as MessageEvent<string>,
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
            event as MessageEvent<string>,
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
            event as MessageEvent<string>,
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
          const data = readEventData<{ message?: string; error?: string }>(
            event as MessageEvent<string>,
          );
          setStatus('failed');
          setRunMessage(data?.message ?? data?.error ?? 'Bench stream failed');
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
    clearActiveJobConnection,
    env,
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

  const benchBodyStyle = {
    '--bench-report-width': `${reportPaneWidth}px`,
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
    if (!report) return null;
    return [...report.summaries].sort(
      (a, b) => b.avgJudgeScore - a.avgJudgeScore,
    )[0] ?? null;
  }, [report]);

  return (
    <div className='benchPage'>
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
                  disabled={status === 'running' || runCount === 0}
                  onClick={startBench}
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
                <strong>{env.model || 'Model default'}</strong>
                <small>{env.apiKey.trim() ? 'Key set' : 'No key'}</small>
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
                            </div>

                            <details className='benchHistoryDetails'>
                              <summary>Configuration snapshot</summary>
                              <div className='benchHistorySnapshot'>
                                <div>
                                  <span>Base URL</span>
                                  <strong>{entry.config.env.baseURL}</strong>
                                </div>
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
