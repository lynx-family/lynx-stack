// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Auto-flush scheduler. See Shim_Design.md §5.3 + OQ-S.1 resolution
 * (auto-flush at microtask boundary).
 *
 * Every L2+ mutation that affects engine-visible state calls
 * `scheduleFlush()`. The first call within a microtask schedules a
 * `queueMicrotask(__FlushElementTree)`; subsequent calls within the same
 * microtask are no-ops. This yields exactly one engine flush per JS frame,
 * matching the "async layout" behavior web apps expect.
 *
 * Callers that want full control can disable auto-flush via
 * `setAutoFlush(false)` and invoke `flush()` explicitly.
 */

let autoFlushEnabled = true;
let pending = false;

export function setAutoFlush(enabled: boolean): void {
  autoFlushEnabled = enabled;
}

export function isAutoFlushEnabled(): boolean {
  return autoFlushEnabled;
}

/**
 * Schedule a synchronous `flush()` at the next microtask boundary.
 * No-op when auto-flush is disabled, or when a flush is already pending.
 */
export function scheduleFlush(): void {
  if (!autoFlushEnabled) return;
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    flush();
  });
}

/**
 * Run `__FlushElementTree` immediately, synchronously. Safe to call from
 * caller code at any time; the auto-flush scheduler also calls this.
 *
 * If the engine doesn't expose `__FlushElementTree` (e.g. unit test mock)
 * we swallow the error — auto-flush should not break callers that don't
 * care about flushing.
 */
export function flush(): void {
  try {
    __FlushElementTree();
  } catch {
    // Engine missing __FlushElementTree — no-op for tests.
  }
}

/**
 * Test-only: reset the pending bit. Production code should never need this.
 * Exposed so tests that examine pending behavior can clean up between cases.
 */
export function _resetSchedulerForTesting(): void {
  pending = false;
  autoFlushEnabled = true;
}
