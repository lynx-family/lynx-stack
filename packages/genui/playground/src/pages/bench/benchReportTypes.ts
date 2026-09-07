// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  BenchGroup,
  BenchProfile,
  BenchProtocol,
  BenchRole,
  BenchScenario,
  BenchSettings,
} from './benchData.js';

export type BenchStatus =
  | 'cancelled'
  | 'complete'
  | 'failed'
  | 'idle'
  | 'running';

export interface BenchJudgeDimensionResult {
  dimension: string;
  dimensionLabel: string;
  error?: string;
  reason?: string;
  score: number;
  summary?: string;
  weight: number;
}

export interface BenchResult {
  agentMs: number;
  attempts: number;
  catalog?: string;
  error?: string;
  errors?: string[];
  fmpMs: number;
  groupId: string;
  groupName: string;
  id: string;
  judgeDimensions?: BenchJudgeDimensionResult[];
  judgeGeqiScore?: number;
  judgeScore: number;
  judgeStatus?: 'complete' | 'failed' | 'skipped';
  judgeWarnings?: string[];
  messageCount?: number;
  model?: string;
  ok?: boolean;
  outputChars?: number;
  profile?: BenchProfile;
  protocol?: BenchProtocol;
  renderMs: number;
  repeatIndex?: number;
  role: BenchRole;
  scenarioId: string;
  scenarioName: string;
  screenshotDataUrl?: string;
  status?: 'complete' | 'failed';
  ttiMs: number;
  tokens: number;
}

export interface BenchGroupSummary {
  avgAgentMs: number;
  avgAttempts: number;
  avgFmpMs: number;
  avgJudgeGeqiScore?: number;
  avgJudgeScore: number;
  avgRenderMs: number;
  avgTokens: number;
  avgTtiMs: number;
  failedRuns?: number;
  groupId: string;
  groupName: string;
  judgeRunCount?: number;
  profile?: BenchProfile;
  protocol?: BenchProtocol;
  role: BenchRole;
  runCount?: number;
  successRate?: number;
}

export interface BenchReport {
  capabilities?: {
    agent: 'enabled';
    judge: 'disabled' | 'enabled';
    renderMetrics: 'disabled' | 'enabled';
  };
  completedAt?: string;
  createdAt: string;
  env: {
    apiKeyConfigured: boolean;
    clientOverrideAccepted?: boolean;
    model: string;
  };
  groups: BenchGroup[];
  id: string;
  jobId?: string;
  results: BenchResult[];
  scenarios: BenchScenario[];
  settings: BenchSettings;
  status?: BenchStatus;
  summaries: BenchGroupSummary[];
  summary?: {
    avgAgentMs: number;
    avgAttempts: number;
    avgTokens: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    totalRuns: number;
  };
  warnings?: string[];
}
