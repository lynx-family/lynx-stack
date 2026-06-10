// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIMessage } from '../agent/a2ui-validator';

export type BenchRole = 'control' | 'experiment';
export type BenchVariable = 'model' | 'prompt' | 'catalog' | 'custom';
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
  | 'judge'
  | 'complete'
  | 'failed';

export interface BenchProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  api?: 'chat' | 'responses';
}

export interface BenchPlaygroundConfig {
  baseUrl?: string;
}

export interface BenchSettings {
  repeats: number;
  parallelism: number;
  maxRepairAttempts: number;
  repairEnabled: boolean;
  judgeEnabled: boolean;
  renderMetricsEnabled: boolean;
  timeoutMs?: number;
}

export interface BenchGroupRequest {
  id: string;
  role: BenchRole;
  name: string;
  variable: BenchVariable;
  enabled: boolean;
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
  scenarioId: string;
  scenarioName: string;
  repeatIndex: number;
  status: 'complete' | 'failed';
  ok: boolean;
  model: string;
  catalog: BenchCatalogLabel;
  tokens: number;
  agentMs: number;
  fmpMs: number;
  ttiMs: number;
  renderMs: number;
  attempts: number;
  judgeScore: number;
  messageCount: number;
  outputChars: number;
  errors: string[];
  error?: string;
  finishReason?: unknown;
  usage?: unknown;
  messages?: A2UIMessage[];
  text?: string;
}

export interface BenchGroupSummary {
  groupId: string;
  groupName: string;
  role: BenchRole;
  runCount: number;
  failedRuns: number;
  successRate: number;
  avgTokens: number;
  avgAgentMs: number;
  avgFmpMs: number;
  avgTtiMs: number;
  avgRenderMs: number;
  avgJudgeScore: number;
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
  status: BenchJobStatus;
  settings: BenchSettings;
  env: {
    apiKeyConfigured: boolean;
    baseURL: string;
    model: string;
    clientOverrideAccepted: boolean;
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
  summaries: BenchGroupSummary[];
  summary: BenchReportSummary;
}

export interface BenchJobSnapshot {
  ok: true;
  jobId: string;
  status: BenchJobStatus;
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
