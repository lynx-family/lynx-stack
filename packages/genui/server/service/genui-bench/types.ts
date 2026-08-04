// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const BENCH_PROTOCOLS = ['a2ui', 'openui'] as const;

export type BenchProtocol = (typeof BENCH_PROTOCOLS)[number];

export interface ProtocolBenchProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  api?: 'chat' | 'responses';
}

export interface ProtocolBenchScenario {
  id: string;
  name: string;
  prompt: string;
  type: string;
  complexity: 1 | 2 | 3;
  action?: string;
  judgeTask?: string;
  judgeSteps?: string[];
}

export interface ProtocolBenchAttemptResult {
  index: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  valid: boolean;
  validationErrors: string[];
  outputChars: number;
  finishReason?: unknown;
}

export type ProtocolBenchEvaluationStatus = 'passed' | 'failed' | 'not-run';

export interface ProtocolBenchRenderResult {
  status: ProtocolBenchEvaluationStatus;
  durationMs: number;
  reason?: string;
  error?: string;
  warnings?: string[];
}

export interface ProtocolBenchJudgeResult {
  status: ProtocolBenchEvaluationStatus;
  score: number;
  model: string;
  durationMs: number;
  screenshotDataUrl?: string;
  reason?: string;
  summary?: string;
  error?: string;
  warnings?: string[];
}
