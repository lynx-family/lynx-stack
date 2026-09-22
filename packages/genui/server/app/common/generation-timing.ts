// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Measure the generation pipeline once, before publishing its artifact. */
export function createGenerationTiming() {
  const startedAt = performance.now();
  let metrics: { generationMs: number } | undefined;
  return {
    finish() {
      metrics ??= { generationMs: performance.now() - startedAt };
      return metrics;
    },
  };
}
