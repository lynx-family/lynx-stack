// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  BenchGroupSummary,
  BenchReport,
  BenchResult,
} from './benchReportTypes.js';
import { readBenchTokenUsage } from './benchTokenUsage.js';
import {
  estimateTokenCost,
  sumEstimatedCosts,
} from '../../utils/modelPricing.js';

export function benchResultCost(result: BenchResult): number | undefined {
  return estimateTokenCost(
    readBenchTokenUsage(result.usage),
    result.modelPrices,
  );
}

export function benchTotalCost(results: BenchResult[]): number | undefined {
  return sumEstimatedCosts(results.map(result => benchResultCost(result)));
}

export function benchGroupAverageCost(
  report: BenchReport,
  summary: BenchGroupSummary,
): number | undefined {
  const total = benchTotalCost(
    report.results.filter(result => result.groupId === summary.groupId),
  );
  const planned = summary.plannedRuns
    ?? report.scenarios.length * report.settings.repeats;
  return total !== undefined && planned > 0 ? total / planned : undefined;
}
