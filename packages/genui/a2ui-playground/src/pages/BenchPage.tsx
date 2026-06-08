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
type BenchStatus = 'idle' | 'running' | 'complete';

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
  tokens: number;
  agentMs: number;
  fmpMs: number;
  ttiMs: number;
  renderMs: number;
  attempts: number;
  judgeScore: number;
}

interface BenchGroupSummary {
  groupId: string;
  groupName: string;
  role: BenchRole;
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
  createdAt: string;
  settings: BenchSettings;
  env: {
    apiKeyConfigured: boolean;
    baseURL: string;
    model: string;
  };
  groups: BenchGroup[];
  scenarios: BenchScenario[];
  results: BenchResult[];
  summaries: BenchGroupSummary[];
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

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function hashNoise(...parts: string[]): number {
  const source = parts.join('|');
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) % 9973;
  }
  return (hash % 101) / 100;
}

function modelProfile(model: string): {
  token: number;
  latency: number;
  quality: number;
} {
  const normalized = model.toLowerCase();
  if (normalized.includes('deepseek')) {
    return { token: 1.08, latency: 0.72, quality: 3.0 };
  }
  if (normalized.includes('doubao')) {
    return { token: 1.0, latency: 0.88, quality: 2.35 };
  }
  if (normalized.includes('gemini')) {
    return { token: 1.12, latency: 1.04, quality: 3.05 };
  }
  if (normalized.includes('gpt')) {
    return { token: 0.92, latency: 1.0, quality: 3.1 };
  }
  return { token: 1.0, latency: 1.0, quality: 2.75 };
}

function catalogProfile(catalog: string): {
  token: number;
  render: number;
  quality: number;
} {
  if (catalog === 'Minimal Catalog') {
    return { token: 0.66, render: 0.86, quality: -0.28 };
  }
  if (catalog === 'Core Catalog') {
    return { token: 0.78, render: 0.92, quality: -0.08 };
  }
  return { token: 1.0, render: 1.0, quality: 0.04 };
}

function promptProfile(instruction: string): {
  token: number;
  latency: number;
  quality: number;
} {
  const normalized = instruction.toLowerCase();
  if (
    normalized.includes('short')
    || normalized.includes('token')
    || normalized.includes('concise')
    || normalized.includes('fewer')
  ) {
    return { token: 0.76, latency: 0.82, quality: -0.06 };
  }
  if (
    normalized.includes('visual')
    || normalized.includes('polish')
    || normalized.includes('hierarchy')
  ) {
    return { token: 1.14, latency: 1.06, quality: 0.18 };
  }
  return { token: 1.0, latency: 1.0, quality: 0 };
}

function createResult(
  group: BenchGroup,
  scenario: BenchScenario,
  env: BenchEnv,
  settings: BenchSettings,
  repeat: number,
): BenchResult {
  const model = group.model.trim() || env.model;
  const modelFx = modelProfile(model);
  const catalogFx = catalogProfile(group.catalog);
  const promptFx = promptProfile(group.extraInstruction);
  const noise = hashNoise(group.id, scenario.id, String(repeat));
  const variance = 0.94 + noise * 0.12;
  const qualityVariance = (noise - 0.5) * 0.28;
  const baseTokens = 8400 * scenario.complexity;
  const baseAgentMs = 14200 * scenario.complexity;
  const baseFmpMs = 620 * scenario.complexity;
  const baseTtiMs = 920 * scenario.complexity;
  const baseRenderMs = 240 * scenario.complexity;
  const judgeScore = Math.max(
    0,
    Math.min(
      5,
      modelFx.quality + catalogFx.quality + promptFx.quality
        + qualityVariance,
    ),
  );
  const repairAttempt = settings.repairEnabled && judgeScore < 2.65 ? 1 : 0;
  const attempts = 1 + repairAttempt;
  const repairMultiplier = attempts > 1 ? 1.18 : 1;

  return {
    id: `${group.id}-${scenario.id}-${repeat}`,
    groupId: group.id,
    groupName: group.name,
    role: group.role,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    tokens: Math.round(
      baseTokens * modelFx.token * catalogFx.token * promptFx.token
        * variance * repairMultiplier,
    ),
    agentMs: Math.round(
      baseAgentMs * modelFx.latency * promptFx.latency * variance
        * repairMultiplier,
    ),
    fmpMs: Math.round(baseFmpMs * catalogFx.render * variance),
    ttiMs: Math.round(baseTtiMs * catalogFx.render * variance),
    renderMs: Math.round(baseRenderMs * catalogFx.render * variance),
    attempts,
    judgeScore: settings.judgeEnabled ? Number(judgeScore.toFixed(1)) : 0,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeGroup(
  group: BenchGroup,
  results: BenchResult[],
): BenchGroupSummary {
  const groupResults = results.filter((item) => item.groupId === group.id);
  return {
    groupId: group.id,
    groupName: group.name,
    role: group.role,
    avgTokens: average(groupResults.map((item) => item.tokens)),
    avgAgentMs: average(groupResults.map((item) => item.agentMs)),
    avgFmpMs: average(groupResults.map((item) => item.fmpMs)),
    avgTtiMs: average(groupResults.map((item) => item.ttiMs)),
    avgRenderMs: average(groupResults.map((item) => item.renderMs)),
    avgJudgeScore: average(groupResults.map((item) => item.judgeScore)),
    avgAttempts: average(groupResults.map((item) => item.attempts)),
  };
}

function buildReport(
  groups: BenchGroup[],
  scenarios: BenchScenario[],
  env: BenchEnv,
  settings: BenchSettings,
): BenchReport {
  const results = groups.flatMap((group) =>
    scenarios.flatMap((scenario) =>
      Array.from(
        { length: settings.repeats },
        (_, index) => createResult(group, scenario, env, settings, index + 1),
      )
    )
  );
  return {
    id: createId('bench-report'),
    createdAt: new Date().toISOString(),
    settings,
    env: {
      apiKeyConfigured: env.apiKey.trim().length > 0,
      baseURL: env.baseURL,
      model: env.model,
    },
    groups,
    scenarios,
    results,
    summaries: groups.map((group) => summarizeGroup(group, results)),
  };
}

function deltaText(value: number, baseline: number, suffix = ''): string {
  if (baseline === 0) return 'n/a';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%${suffix}`;
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
  const [configOpen, setConfigOpen] = useState(false);
  const [reportPaneWidth, setReportPaneWidth] = useState(
    getInitialReportPaneWidth,
  );
  const [isResizingReport, setIsResizingReport] = useState(false);
  const [report, setReport] = useState<BenchReport | null>(() =>
    buildReport(
      DEFAULT_GROUPS,
      DEFAULT_SCENARIOS,
      DEFAULT_ENV,
      DEFAULT_SETTINGS,
    )
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const benchBodyRef = useRef<HTMLDivElement | null>(null);
  const runTimerRef = useRef<number | null>(null);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.enabled),
    [groups],
  );
  const runCount = activeGroups.length * scenarios.length * settings.repeats;
  const activeScenarioTypes = useMemo(
    () => [...new Set(scenarios.map((scenario) => scenario.type))],
    [scenarios],
  );

  const clearRunTimer = useCallback(() => {
    if (runTimerRef.current !== null) {
      window.clearInterval(runTimerRef.current);
      runTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearRunTimer, [clearRunTimer]);

  useEffect(() => {
    if (!configOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfigOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configOpen]);

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
    clearRunTimer();
    setEnv(DEFAULT_ENV);
    setGroups(DEFAULT_GROUPS);
    setScenarios(DEFAULT_SCENARIOS);
    setSettings(DEFAULT_SETTINGS);
    setStatus('idle');
    setProgress(0);
    setReport(
      buildReport(
        DEFAULT_GROUPS,
        DEFAULT_SCENARIOS,
        DEFAULT_ENV,
        DEFAULT_SETTINGS,
      ),
    );
  }, [clearRunTimer]);

  const startBench = useCallback(() => {
    if (runCount === 0) return;
    clearRunTimer();
    setStatus('running');
    setProgress(0);

    const startedAt = window.performance.now();
    const durationMs = Math.max(1800, Math.min(5600, runCount * 220));

    runTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        clearRunTimer();
        setReport(buildReport(activeGroups, scenarios, env, settings));
        setStatus('complete');
      }
    }, 120);
  }, [
    activeGroups,
    clearRunTimer,
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
            <span className='chip'>{runCount} runs</span>
            <Button
              variant='secondary'
              size='sm'
              iconBefore={Zap}
              onClick={() => setConfigOpen(true)}
            >
              Configure
            </Button>
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
                <strong>
                  {report && report.summaries.length > 0
                    ? `${
                      average(
                        report.summaries.map((item) => item.avgJudgeScore),
                      ).toFixed(1)
                    }/5`
                    : 'n/a'}
                </strong>
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
                  {status === 'running' ? 'Running' : 'Run Bench'}
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
                    width: `${status === 'running' ? progress : 100}%`,
                  }}
                />
              </div>
              <div className='benchRunMeta'>
                {status === 'running'
                  ? `${Math.round(progress)}% complete`
                  : `${runCount} planned runs`}
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
                  {activeGroups.length} groups · {scenarios.length} scenarios ·
                  {' '}
                  {settings.repeats} repeats
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
                            {settings.judgeEnabled
                              ? `${summary.avgJudgeScore.toFixed(1)}/5`
                              : 'off'}
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
                    Metrics mirror Agent, FMP, TTI, Render, Tokens, Attempts,
                    and ui-judge dimensions.
                  </span>
                </div>
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
