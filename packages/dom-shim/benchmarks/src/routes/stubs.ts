// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Route, RouteContext, RouteRoundResult } from '../types.ts';

/**
 * Stub Route implementations used by US-104 until US-105/106/107 land real
 * runners. They return canned results so the harness end-to-end shape is
 * exercisable, but they are NOT a substitute for real LLM invocation.
 *
 * Each stub honors `ctx.dry_run`. In dry-run mode it returns a synthetic
 * "all green" record. Outside dry-run, it throws — the harness must not run
 * against stubs in a real benchmark.
 */
function stubRun(id: 'A' | 'B' | 'C') {
  return (ctx: RouteContext): Promise<RouteRoundResult> => {
    if (!ctx.dry_run) {
      return Promise.reject(
        new Error(
          `Route ${id} is a stub and cannot run a real benchmark. `
            + `Replace with the real implementation (US-10${
              id === 'A' ? 5 : (id === 'B' ? 6 : 7)
            }).`,
        ),
      );
    }
    return Promise.resolve({
      generated_code:
        `// dry-run stub for route ${id}, prompt ${ctx.prompt.id}, round ${ctx.round}`,
      parse_ok: true,
      render_ok: true,
      error_log: '',
      screenshot_path: null,
      visual_score: null,
      visual_rationale: null,
    });
  };
}

export const ROUTE_A_STUB: Route = { id: 'A', run: stubRun('A') };
export const ROUTE_B_STUB: Route = { id: 'B', run: stubRun('B') };
export const ROUTE_C_STUB: Route = { id: 'C', run: stubRun('C') };

export const ALL_STUBS: Record<'A' | 'B' | 'C', Route> = {
  A: ROUTE_A_STUB,
  B: ROUTE_B_STUB,
  C: ROUTE_C_STUB,
};
