// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** One generation-stage clock shared by all attempts, excluding admission and Judge. */
export function createBenchGenerationTiming() {
  const startedAt = performance.now();
  let firstTextTokenMs: number | undefined;
  return {
    observe: (event: string) => {
      if (
        event === 'agent.model.first_text_token'
        && firstTextTokenMs === undefined
      ) {
        firstTextTokenMs = performance.now() - startedAt;
      }
    },
    metrics() {
      return firstTextTokenMs === undefined ? {} : { firstTextTokenMs };
    },
  };
}
