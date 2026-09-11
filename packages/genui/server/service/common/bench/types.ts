// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchProtocol } from './protocol-types.js';
import type { A2UIMessage } from '../../../agent/a2ui/a2ui-validator.js';

export type BenchRole = 'control' | 'experiment';
export type { BenchProtocol } from './protocol-types.js';
export type BenchProfile = 'native' | 'matched-core';
export type BenchVariable =
  | 'model'
  | 'prompt'
  | 'catalog'
  | 'protocol'
  | 'custom';
export type BenchCatalogLabel =
  | 'Full Catalog'
  | 'Core Catalog'
  | 'Minimal Catalog';
export type BenchJobStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled';
export type BenchRunPhase =
  | 'queued'
  | 'agent'
  | 'validate'
  | 'render'
  | 'screenshot-queued'
  | 'screenshot'
  | 'judge-queued'
  | 'judge-retry'
  | 'judge'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type BenchStageStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface BenchRunProgress {
  groupId: string;
  scenarioId: string;
  repeatIndex: number;
  revision: number;
  phase: BenchRunPhase;
  generation: BenchStageStatus;
  screenshot: BenchStageStatus;
  judge: BenchStageStatus;
  error?: string;
}

export interface BenchProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  api?: 'chat' | 'responses';
}

export interface BenchPlaygroundConfig {
  baseUrl?: string;
  browserScreenshots?: boolean;
}

export interface BenchSettings {
  repeats: number;
  maxRepairAttempts: number;
  repairEnabled: boolean;
  judgeEnabled: boolean;
  uiJudgeModel?: string;
  renderMetricsEnabled: boolean;
  timeoutMs?: number;
}

export interface BenchGroupRequest {
  enableHtmlFragment?: boolean;
  id: string;
  role: BenchRole;
  name: string;
  variable: BenchVariable;
  enabled: boolean;
  protocol?: BenchProtocol;
  profile?: BenchProfile;
  model?: string;
  catalog?: BenchCatalogLabel;
  extraInstruction?: string;
}

export interface BenchScenarioRequest {
  id: string;
  name: string;
  prompt: string;
  type: string;
  complexity?: number;
  action?: string;
  judgeTask?: string;
  judgeSteps?: string[];
}

export interface BenchJobRequest {
  provider: BenchProviderConfig;
  playground?: BenchPlaygroundConfig;
  settings: BenchSettings;
  groups: BenchGroupRequest[];
  scenarios: BenchScenarioRequest[];
}

export interface BenchProgress {
  completedRuns: number;
  totalRuns: number;
  runs?: BenchRunProgress[];
  current?: {
    groupId: string;
    scenarioId: string;
    repeatIndex: number;
    phase: BenchRunPhase;
  };
}

export interface BenchRunResult {
  id: string;
  groupId: string;
  groupName: string;
  role: BenchRole;
  protocol: BenchProtocol;
  profile: BenchProfile;
  scenarioId: string;
  scenarioName: string;
  repeatIndex: number;
  status: 'complete' | 'failed';
  ok: boolean;
  model: string;
  catalog: BenchCatalogLabel | 'matched-core' | 'none';
  tokens: number;
  agentMs: number;
  fmpMs: number;
  ttiMs: number;
  renderMs: number;
  attempts: number;
  judgeDimensions?: BenchJudgeDimensionResult[];
  judgeGeqiScore?: number;
  judgeScore: number;
  judgeReason?: string;
  judgeStatus?: 'complete' | 'failed' | 'skipped';
  judgeSummary?: string;
  judgeWarnings?: string[];
  messageCount: number;
  outputChars: number;
  errors: string[];
  error?: string;
  finishReason?: unknown;
  usage?: unknown;
  messages?: A2UIMessage[];
  screenshotDataUrl?: string;
  adapterMetadata?: Record<string, unknown>;
  text?: string;
}

export interface BenchJudgeDimensionResult {
  dimension: string;
  dimensionLabel: string;
  error?: string;
  reason?: string;
  score: number;
  summary?: string;
  weight: number;
}

export interface BenchGroupSummary {
  groupId: string;
  groupName: string;
  role: BenchRole;
  protocol: BenchProtocol;
  profile: BenchProfile;
  plannedRuns: number;
  runCount: number;
  failedRuns: number;
  successRate: number;
  avgTokens: number;
  avgAgentMs: number;
  avgFmpMs: number;
  avgTtiMs: number;
  avgRenderMs: number;
  avgJudgeScore: number;
  avgJudgeGeqiScore?: number;
  judgeRunCount: number;
  avgAttempts: number;
}

export interface BenchReportSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number;
  avgTokens: number;
  avgAgentMs: number;
  avgAttempts: number;
}

export interface BenchReport {
  id: string;
  jobId: string;
  createdAt: string;
  completedAt: string;
  /** Absent in reports recorded before job timing was introduced. */
  startedAt?: string;
  durationMs?: number;
  status: BenchJobStatus;
  settings: BenchSettings;
  env: {
    model: string;
  };
  capabilities: {
    agent: 'enabled';
    renderMetrics: 'disabled' | 'enabled';
    judge: 'disabled' | 'enabled';
  };
  warnings: string[];
  groups: BenchGroupRequest[];
  scenarios: BenchScenarioRequest[];
  results: BenchRunResult[];
  runProgress?: BenchRunProgress[];
  summaries: BenchGroupSummary[];
  summary: BenchReportSummary;
}

export interface BenchJobSnapshot {
  ok: true;
  jobId: string;
  status: BenchJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  progress: BenchProgress;
  summary?: BenchReportSummary;
  error?: string;
  warnings: string[];
}

export interface BenchJobEvent {
  id: number;
  event: string;
  data: unknown;
}
