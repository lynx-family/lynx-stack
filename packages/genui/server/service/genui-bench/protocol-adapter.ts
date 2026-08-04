// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BenchProtocol,
  ProtocolBenchAttemptResult,
  ProtocolBenchJudgeResult,
  ProtocolBenchProviderConfig,
  ProtocolBenchRenderResult,
  ProtocolBenchScenario,
} from './types';

export type { ProtocolBenchProviderConfig } from './types';

export type ProtocolBenchJudgePayload =
  | {
    kind: 'a2ui-messages';
    messages: unknown[];
  }
  | {
    kind: 'openui-text';
    rawText: string;
  };

export interface ProtocolBenchAdapterInput {
  runId: string;
  pairId: string;
  scenario: ProtocolBenchScenario;
  repeatIndex: number;
  maxAttempts: number;
  provider: ProtocolBenchProviderConfig;
}

/**
 * Protocol adapters own protocol prompting, validation, and repair. The runner
 * owns paired scheduling, aggregation, rendering, and judging.
 */
export interface ProtocolBenchRunArtifact {
  attempts: ProtocolBenchAttemptResult[];
  finalValid: boolean;
  finalText?: string;
  finalErrors: string[];
  warnings?: string[];
  judgePayload?: ProtocolBenchJudgePayload;
  metadata?: Record<string, unknown>;
}

export interface ProtocolBenchAdapter {
  protocol: BenchProtocol;
  generate(
    input: ProtocolBenchAdapterInput,
    signal?: AbortSignal,
  ): Promise<ProtocolBenchRunArtifact>;
}

export interface ProtocolBenchEvaluationInput {
  runId: string;
  pairId: string;
  protocol: BenchProtocol;
  scenario: ProtocolBenchScenario;
  repeatIndex: number;
  payload: ProtocolBenchJudgePayload;
}

export type ProtocolBenchRenderEvaluator = (
  input: ProtocolBenchEvaluationInput,
  signal?: AbortSignal,
) => Promise<ProtocolBenchRenderResult>;

export type ProtocolBenchJudgeEvaluator = (
  input: ProtocolBenchEvaluationInput & { model: string },
  signal?: AbortSignal,
) => Promise<ProtocolBenchJudgeResult>;
