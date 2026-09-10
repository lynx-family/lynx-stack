// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// This module is pulled into the common chunk, so with sharing enabled every
// page in the group evaluates it once and observes the same state. Without
// sharing each page gets its own copy and the counters move independently.

// Captured at eval time, on purpose. They belong to whichever page evaluated
// this module first, which is exactly what breaks once that page is closed
// unless the timers come from the standalone runtime.
const capturedSetTimeout = setTimeout;
const CapturedPromise = Promise;

/** Distinguishes module instances: equal across pages only when shared. */
export const instanceId = `${Date.now()}-${
  Math.random().toString(36).slice(2, 7)
}`;

let count = 0;
const listeners = new Set<() => void>();

export function getCount(): number {
  return count;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function increment(): void {
  count += 1;
  listeners.forEach((listener) => listener());
}

/**
 * Bumps the counter after a delay, through the captured timer and Promise.
 * Close the page that evaluated this module, then run it from another page:
 * it still resolves when the timers come from the standalone runtime.
 */
export function incrementLater(delayMs = 1500): Promise<void> {
  return new CapturedPromise<void>((resolve) => {
    capturedSetTimeout(() => {
      increment();
      resolve();
    }, delayMs);
  });
}
