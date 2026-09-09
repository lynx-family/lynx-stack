// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchGroupSummary, BenchReport } from './benchReportTypes.js';

export interface BenchTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

const TOKEN_KEYS = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'cachedTokens',
  'cacheWriteTokens',
  'reasoningTokens',
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function count(value: unknown): number | undefined {
  const candidate = typeof value === 'object' ? record(value).total : value;
  return typeof candidate === 'number' && Number.isFinite(candidate)
      && candidate >= 0
    ? candidate
    : undefined;
}

function pick(value: unknown, keys: readonly string[]): number | undefined {
  const source = record(value);
  for (const key of keys) {
    const result = count(source[key]);
    if (result !== undefined) return result;
  }
  return undefined;
}

export function sumBenchTokenUsage(
  usages: BenchTokenUsage[],
  divisor = 1,
): BenchTokenUsage {
  const result: BenchTokenUsage = {};
  if (usages.length === 0 || divisor <= 0) return result;
  for (const key of TOKEN_KEYS) {
    // A missing field in any call means the complete breakdown is unknown.
    if (usages.every((usage) => usage[key] !== undefined)) {
      result[key] = usages.reduce((sum, usage) => sum + usage[key]!, 0)
        / divisor;
    }
  }
  return result;
}

export function readBenchTokenUsage(value: unknown): BenchTokenUsage {
  if (Array.isArray(value)) {
    return sumBenchTokenUsage(value.map((item) => readBenchTokenUsage(item)));
  }
  const source = record(value);
  const inputTokens = pick(source, [
    'inputTokens',
    'promptTokens',
    'input_tokens',
    'prompt_tokens',
  ]);
  const outputTokens = pick(source, [
    'outputTokens',
    'completionTokens',
    'output_tokens',
    'completion_tokens',
  ]);
  const totalTokens = pick(source, ['totalTokens', 'total_tokens'])
    ?? (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);
  const inputDetails = [
    source,
    source.inputTokens,
    source.inputTokenDetails,
    source.inputTokensDetails,
    source.input_tokens_details,
    source.prompt_tokens_details,
  ];
  const outputDetails = [
    source,
    source.outputTokens,
    source.outputTokenDetails,
    source.outputTokensDetails,
    source.output_tokens_details,
    source.completion_tokens_details,
  ];
  const find = (values: unknown[], keys: string[]) =>
    values.map((item) => pick(item, keys))
      .find((item) => item !== undefined);
  const cachedTokens = find(inputDetails, [
    'cachedTokens',
    'cached_tokens',
    'cachedInputTokens',
    'cached_input_tokens',
    'cacheReadTokens',
    'cacheRead',
    'cache_read_input_tokens',
  ]);
  const cacheWriteTokens = find(inputDetails, [
    'cacheWriteTokens',
    'cacheWrite',
    'cache_write_tokens',
    'cache_creation_input_tokens',
  ]);
  const reasoningTokens = find(outputDetails, [
    'reasoningTokens',
    'reasoning_tokens',
    'reasoning',
  ]);
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
    ...(cachedTokens === undefined ? {} : { cachedTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
  };
}

export function groupBenchTokenUsage(
  report: BenchReport,
  summary: BenchGroupSummary,
): BenchTokenUsage {
  const results = report.results.filter((result) =>
    result.groupId === summary.groupId
  );
  const plannedRuns = summary.plannedRuns
    ?? report.scenarios.length * report.settings.repeats;
  return sumBenchTokenUsage(
    results.map((result) => readBenchTokenUsage(result.usage)),
    plannedRuns,
  );
}
