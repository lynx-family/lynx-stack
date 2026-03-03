// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Cross-thread invocation stubs.
 *
 * Phase 1: these are placeholder APIs that log warnings. The actual
 * implementation requires the SWC worklet transform (Phase 2) to extract
 * closure variables and register worklet functions on the Main Thread.
 */

/**
 * Mark a function to be executed on the Main Thread.
 *
 * Returns a wrapper that, when called from the Background Thread, dispatches
 * the call to the Main Thread via the worklet runtime.
 *
 * Phase 1: returns a stub that logs a warning. The SWC transform (Phase 2)
 * replaces the function body with a worklet context object at build time.
 *
 * @example
 * ```ts
 * const animate = runOnMainThread((x: number) => {
 *   'main thread'
 *   element.setStyleProperty('opacity', String(x))
 * })
 * animate(0.5) // executes on Main Thread
 * ```
 */
export function runOnMainThread<
  F extends (...args: unknown[]) => unknown,
>(fn: F): F {
  if (__DEV__) {
    console.warn(
      '[vue-lynx] runOnMainThread() requires the SWC worklet transform '
        + '(Phase 2). The function will execute on the Background Thread as a '
        + 'fallback.',
    );
  }
  return fn;
}
