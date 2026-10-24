// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BenchGroupSummary, BenchReport } from './benchReportTypes.js';
import { readTokenUsage, sumTokenUsage } from '../../utils/tokenUsage.js';
import type { TokenUsage } from '../../utils/tokenUsage.js';

export {
  readTokenUsage as readBenchTokenUsage,
  sumTokenUsage as sumBenchTokenUsage,
} from '../../utils/tokenUsage.js';
export type { TokenUsage as BenchTokenUsage } from '../../utils/tokenUsage.js';

export function groupBenchTokenUsage(
  report: BenchReport,
  summary: BenchGroupSummary,
): TokenUsage {
  const results = report.results.filter((result) =>
    result.groupId === summary.groupId
  );
  const plannedRuns = summary.plannedRuns
    ?? report.scenarios.length * report.settings.repeats;
  return sumTokenUsage(
    results.map((result) => readTokenUsage(result.usage)),
    plannedRuns,
  );
}
