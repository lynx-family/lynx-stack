// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function readGenerationMetrics(
  payload: unknown,
): { generationMs: number } | undefined {
  if (!payload || typeof payload !== 'object' || !('metrics' in payload)) {
    return undefined;
  }
  const metrics = payload.metrics;
  if (!metrics || typeof metrics !== 'object' || !('generationMs' in metrics)) {
    return undefined;
  }
  const value = metrics.generationMs;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? { generationMs: value }
    : undefined;
}
