// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A drop-in surface of `@lynx-js/react` so existing example sources run on
 * the transform-free runtime unmodified (the rspeedy plugin aliases
 * `@lynx-js/react` here). Only the APIs the examples actually use are
 * provided; compiler-bound APIs get explanatory stubs.
 */

import { useRef } from 'preact/hooks';

export * from '../index.js';

/**
 * Main-thread refs need the compiler to move code across threads. On this
 * runtime a plain ref object is returned; `main-thread:ref` is not wired.
 *
 * @public
 */
export function useMainThreadRef<T>(initValue?: T): { current: T | null } {
  return useRef<T | null>(initValue ?? null);
}

/**
 * `runOnBackground` is only meaningful inside main-thread functions, which
 * are closure-free on this runtime — so a captured import can never reach
 * the main thread. Calling the returned function on the background thread
 * simply invokes the target directly.
 *
 * @public
 */
export function runOnBackground<Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
): (...args: Args) => Promise<Ret> {
  return (...args) => Promise.resolve(fn(...args));
}

/**
 * No-op on this runtime: there is no main-thread first screen to hand over.
 *
 * @public
 */
export function markFirstScreenSyncReady(): void {
  // noop
}
