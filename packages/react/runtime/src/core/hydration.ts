// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The hydration-completion deferred backing `root.hydrate()`. Each thread has
// its own instance of this module state:
// - background thread: completed when the main thread acks the hydration patch
// - main thread: completed right after the hydration patch is applied
let isHydrationCompleted = false;
let resolveHydration: (() => void) | undefined;
let hydrationPromise: Promise<void> | undefined;

function getHydrationPromise(): Promise<void> {
  hydrationPromise ??= isHydrationCompleted
    ? Promise.resolve()
    : new Promise<void>(resolve => {
      resolveHydration = resolve;
    });
  return hydrationPromise;
}

function markHydrationCompleted(): void {
  isHydrationCompleted = true;
  resolveHydration?.();
  resolveHydration = undefined;
}

// Full reset of the deferred. Used by SSR hydration (and tests) to re-initialize.
function resetHydrationState(): void {
  isHydrationCompleted = false;
  resolveHydration = undefined;
  hydrationPromise = undefined;
}

/**
 * @internal
 */
export { getHydrationPromise, markHydrationCompleted, resetHydrationState };
