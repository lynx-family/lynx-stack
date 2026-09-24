// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { PreviewPerformanceMetrics } from '../../storage/types.js';

const GENERATION_METRIC_KEYS = [
  'generationMs',
  'firstReasoningTokenMs',
  'firstTextTokenMs',
  'modelMs',
  'searchMs',
  'imageGenerationMs',
] as const;

export function readGenerationMetrics(
  payload: unknown,
): PreviewPerformanceMetrics | undefined {
  if (!payload || typeof payload !== 'object' || !('metrics' in payload)) {
    return undefined;
  }
  const metrics = payload.metrics;
  if (!metrics || typeof metrics !== 'object') {
    return undefined;
  }
  const record = metrics as Record<string, unknown>;
  const result: PreviewPerformanceMetrics = {};
  for (const key of GENERATION_METRIC_KEYS) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
