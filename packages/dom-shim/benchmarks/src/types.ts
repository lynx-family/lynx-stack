// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Phase 1 benchmark shared types. See PRD.md §3 (US-101..109) and RUBRIC.md
 * for metric semantics.
 */

export type RouteId = 'A' | 'B' | 'C';

export type CorpusCategory =
  | 'interactive'
  | 'form'
  | 'layout'
  | 'list'
  | 'media'
  | 'navigation'
  | 'data-display';

export type CorpusComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';

export interface CorpusEntry {
  id: string;
  category: CorpusCategory;
  prompt: string;
  expected_capabilities: string[];
  complexity: CorpusComplexity;
}

/** Per-(prompt, route, round) record. Streamed as JSONL during the run. */
export interface BenchmarkRecord {
  prompt_id: string;
  prompt_category?: CorpusCategory;
  prompt_complexity?: CorpusComplexity;
  route: RouteId;
  round: number;
  generated_code: string;
  parse_ok: boolean;
  render_ok: boolean;
  screenshot_path: string | null;
  error_log: string;
  visual_score: number | null;
  visual_rationale?: string | null;
  timestamp: string;
  model_id: string;
  tokens_used?: { input: number; output: number };
}

/** Per-route aggregate. */
export interface RouteMetrics {
  parse_ok_rate: number;
  render_ok_rate: number;
  convergence_rate: number;
  visual_score_mean?: number | null;
  sample_size?: number;
  /** Sum of input tokens across all records for this route. */
  total_input_tokens?: number;
  /** Sum of output tokens across all records for this route. */
  total_output_tokens?: number;
  /** Sum of estimated USD cost across all records for this route. */
  estimated_cost_usd?: number;
  /** (total_input_tokens + total_output_tokens) / sample_size. */
  mean_tokens_per_prompt?: number;
  /** True if the run's model_id is not in MODEL_PRICING — cost is 0 placeholder. */
  pricing_missing?: boolean;
}

/** Final benchmark report. Schema-validated by result.schema.json. */
export interface BenchmarkReport {
  schema_version: string;
  run_id: string;
  started_at: string;
  finished_at: string;
  model_id: string;
  rounds: number;
  concurrency: number;
  summary: Partial<Record<RouteId, RouteMetrics>>;
  per_category: Partial<
    Record<CorpusCategory, Partial<Record<RouteId, RouteMetrics>>>
  >;
  records: BenchmarkRecord[];
}

export interface HarnessOptions {
  routes: RouteId[];
  prompts: CorpusEntry[];
  rounds: number;
  model_id: string;
  concurrency: number;
  out_dir: string;
  dry_run: boolean;
  /** Override clock for tests. */
  now?: () => Date;
}

/** Result of running one (prompt, round) attempt on one route. */
export interface RouteRoundResult {
  generated_code: string;
  parse_ok: boolean;
  render_ok: boolean;
  error_log: string;
  screenshot_path: string | null;
  visual_score: number | null;
  visual_rationale: string | null;
  tokens_used?: { input: number; output: number };
}

export interface RouteContext {
  prompt: CorpusEntry;
  /** Round number, 1-indexed. */
  round: number;
  /** The artifact and error_log from the previous round (round > 1 only). */
  previous?: { generated_code: string; error_log: string };
  /** When true, return a canned non-API result. */
  dry_run: boolean;
  /** Model id requested by the harness. */
  model_id: string;
  /** Absolute path to the run's output directory (for screenshots etc.). */
  out_dir: string;
}

/** Pluggable route runner. Implementations live under src/routes/. */
export interface Route {
  id: RouteId;
  run(ctx: RouteContext): Promise<RouteRoundResult>;
}
