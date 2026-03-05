// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Cross-thread invocation: dispatch a worklet function call to the Main Thread
 * and receive its return value as a Promise.
 *
 * The SWC worklet transform (Phase 2) replaces the function body with a
 * worklet context object (`{ _wkltId, _c }`) at build time. At runtime,
 * `runOnMainThread` dispatches the context to the Main Thread via
 * 'Lynx.Worklet.runWorkletCtx', where the worklet-runtime executes it.
 */

import { onFunctionCall } from './function-call.js';
import type { Worklet } from './worklet-types.js';

const RUN_WORKLET_CTX = 'Lynx.Worklet.runWorkletCtx';

/**
 * Mark a function to be executed on the Main Thread.
 *
 * Returns a wrapper that, when called from the Background Thread, dispatches
 * the call to the Main Thread via the worklet runtime and returns a Promise
 * that resolves to the function's return value.
 *
 * The SWC worklet transform replaces the `fn` argument with a worklet context
 * object at build time. Without the transform, `fn` is passed through as-is
 * (dev warning in non-production builds).
 *
 * @example
 * ```ts
 * const animate = runOnMainThread((x: number) => {
 *   'main thread'
 *   element.setStyleProperty('opacity', String(x))
 * })
 * await animate(0.5) // executes on Main Thread
 * ```
 */
export function runOnMainThread<R, Fn extends (...args: unknown[]) => R>(
  fn: Fn,
): (...args: Parameters<Fn>) => Promise<R> {
  return async (...params: Parameters<Fn>): Promise<R> => {
    return new Promise((resolve) => {
      const resolveId = onFunctionCall(resolve as (value: unknown) => void);
      lynx.getCoreContext().dispatchEvent({
        type: RUN_WORKLET_CTX,
        data: JSON.stringify({
          worklet: fn as unknown as Worklet,
          params,
          resolveId,
        }),
      });
    });
  };
}
