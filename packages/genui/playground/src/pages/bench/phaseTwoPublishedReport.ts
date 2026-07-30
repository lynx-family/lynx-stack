// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import publishedReport from './data/phase-two-published.json';

export type PhaseTwoProtocol = 'a2ui' | 'openui';
export type PhaseTwoTerminalStatus = 'complete' | 'failed' | 'cancelled';
export type PhaseTwoEvaluationStatus = 'passed' | 'failed' | 'not-run';

export interface PhaseTwoPublishedMetrics {
  plannedRuns: number;
  runCount: number;
  completedRuns: number;
  failedRuns: number;
  passAt1Runs: number;
  passAt1Rate: number;
  finalValidRuns: number;
  finalValidRate: number;
  renderEnabledPlannedRuns: number;
  renderEvaluatedRuns: number;
  renderPassedRuns: number;
  renderCoverageRate: number;
  renderPassRate: number | null;
  judgeEnabledPlannedRuns: number;
  judgeEvaluatedRuns: number;
  judgePassedRuns: number;
  judgeCoverageRate: number;
  judgeScoreTotal: number;
  avgJudgeScoreAllRuns: number | null;
  attemptsTotal: number;
  avgAttemptsAllRuns: number;
  tokensTotal: number;
  avgTokensAllRuns: number;
  generationMsTotal: number;
  avgGenerationMsAllRuns: number;
}

export interface PhaseTwoPublishedProtocolSummary {
  protocol: PhaseTwoProtocol;
  metrics: PhaseTwoPublishedMetrics;
}

export interface PhaseTwoPublishedModelProtocolSummary
  extends PhaseTwoPublishedProtocolSummary
{
  id: string;
  model: string;
}

export interface PhaseTwoPublishedModelSummary {
  model: string;
  metrics: PhaseTwoPublishedMetrics;
  protocols: PhaseTwoPublishedProtocolSummary[];
}

export interface PhaseTwoPublishedRenderResult {
  status: PhaseTwoEvaluationStatus;
  durationMs: number;
}

export interface PhaseTwoPublishedJudgeResult {
  status: PhaseTwoEvaluationStatus;
  score: number;
  model: string;
  durationMs: number;
}

export interface PhaseTwoPublishedRun {
  id: string;
  orderInPair: 1 | 2;
  protocol: PhaseTwoProtocol;
  status: 'complete' | 'failed';
  passAt1: boolean;
  finalValid: boolean;
  attemptCount: number;
  totalTokens: number;
  generationMs: number;
  screenshotUrl?: string;
  render: PhaseTwoPublishedRenderResult;
  judge: PhaseTwoPublishedJudgeResult;
  finalOutputChars: number;
  errors: string[];
  warnings: string[];
}

export interface PhaseTwoPublishedPair {
  id: string;
  sourceReportId: string;
  pairId: string;
  model: string;
  scenarioId: string;
  scenarioName: string;
  repeatIndex: number;
  complete: boolean;
  runs: Partial<Record<PhaseTwoProtocol, PhaseTwoPublishedRun>>;
}

export interface PhaseTwoPublishedScenarioSummary {
  id: string;
  name: string;
  type: string;
  complexity: 1 | 2 | 3;
  models: string[];
  metrics: PhaseTwoPublishedMetrics;
  protocols: PhaseTwoPublishedProtocolSummary[];
  modelProtocols: PhaseTwoPublishedModelProtocolSummary[];
  warnings: string[];
  errors: string[];
}

export interface PhaseTwoPublishedSource {
  id: string;
  jobId: string;
  status: PhaseTwoTerminalStatus;
  createdAt: string;
  completedAt: string;
  model: string;
  plannedRuns: number;
  runCount: number;
  failedRuns: number;
}

export interface PhaseTwoPublishedScope {
  reportCount: number;
  completeReportCount: number;
  modelCount: number;
  scenarioCount: number;
  pairCount: number;
  plannedRuns: number;
  runCount: number;
  failedRuns: number;
}

export interface PhaseTwoPublishedMethodology {
  modes: string[];
  capabilityProfiles: string[];
  protocolVersions: Record<PhaseTwoProtocol, string[]>;
  providerApis: Array<'chat' | 'responses'>;
  judgeModels: string[];
  repeats: number[];
  maxAttempts: number[];
  timeoutMs: number[];
  renderEnabled: boolean[];
  judgeEnabled: boolean[];
}

export interface PhaseTwoPublishedReport {
  schemaVersion: 'genui-bench-phase-2/published-v1';
  title: string;
  larkUrl?: string;
  sources: PhaseTwoPublishedSource[];
  scope: PhaseTwoPublishedScope;
  summary: PhaseTwoPublishedMetrics;
  models: PhaseTwoPublishedModelSummary[];
  modelProtocols: PhaseTwoPublishedModelProtocolSummary[];
  scenarios: PhaseTwoPublishedScenarioSummary[];
  pairs: PhaseTwoPublishedPair[];
  methodology: PhaseTwoPublishedMethodology;
  warnings: string[];
  limitations: string[];
}

export const PHASE_TWO_PUBLISHED_REPORT =
  publishedReport as PhaseTwoPublishedReport;

const EMPTY_METRICS: PhaseTwoPublishedMetrics = {
  plannedRuns: 0,
  runCount: 0,
  completedRuns: 0,
  failedRuns: 0,
  passAt1Runs: 0,
  passAt1Rate: 0,
  finalValidRuns: 0,
  finalValidRate: 0,
  renderEnabledPlannedRuns: 0,
  renderEvaluatedRuns: 0,
  renderPassedRuns: 0,
  renderCoverageRate: 0,
  renderPassRate: null,
  judgeEnabledPlannedRuns: 0,
  judgeEvaluatedRuns: 0,
  judgePassedRuns: 0,
  judgeCoverageRate: 0,
  judgeScoreTotal: 0,
  avgJudgeScoreAllRuns: null,
  attemptsTotal: 0,
  avgAttemptsAllRuns: 0,
  tokensTotal: 0,
  avgTokensAllRuns: 0,
  generationMsTotal: 0,
  avgGenerationMsAllRuns: 0,
};

export const EMPTY_PHASE_TWO_PUBLISHED_REPORT: PhaseTwoPublishedReport = {
  schemaVersion: 'genui-bench-phase-2/published-v1',
  title: 'A2UI vs OpenUI',
  sources: [],
  scope: {
    reportCount: 0,
    completeReportCount: 0,
    modelCount: 0,
    scenarioCount: 0,
    pairCount: 0,
    plannedRuns: 0,
    runCount: 0,
    failedRuns: 0,
  },
  summary: { ...EMPTY_METRICS },
  models: [],
  modelProtocols: [],
  scenarios: [],
  pairs: [],
  methodology: {
    modes: [],
    capabilityProfiles: [],
    protocolVersions: { a2ui: [], openui: [] },
    providerApis: [],
    judgeModels: [],
    repeats: [],
    maxAttempts: [],
    timeoutMs: [],
    renderEnabled: [],
    judgeEnabled: [],
  },
  warnings: [],
  limitations: [],
};
