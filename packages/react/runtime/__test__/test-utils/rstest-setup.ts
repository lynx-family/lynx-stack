// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// rstest-only setup shared by the main + ET suites.
//
// 1. Timer-global guard. The worklet runtime's `initApiEnv()` reassigns
//    `globalThis.{setTimeout,clearTimeout,setInterval,clearInterval,...}` to
//    `lynx.*`, which in the test mocks are frequently `undefined`. Under the
//    `node` environment (vitest's old default) leaving these clobbered was
//    harmless. Under rstest's REQUIRED jsdom environment the jsdom Window owns
//    those globals and its own async timer machinery + `window.close()`
//    teardown call them, so an `undefined` clearTimeout/clearInterval crashes
//    the worker. We install accessor properties that coerce any non-function
//    assignment back to the real timer function: the runtime can still install
//    a real `lynx.*` timer, but an `undefined` mock can no longer break jsdom.
//
// 2. pretty-format (used by rstest's snapshot serializer) prints unnamed mock
//    functions differently than vitest did. The inline snapshots in this suite
//    expect `[MockFunction spy]` for anonymous mocks, so register a serializer
//    that reproduces that output.

import { expect } from '@rstest/core';

const TIMER_GLOBALS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

for (const name of TIMER_GLOBALS) {
  const real = (globalThis as Record<string, unknown>)[name];
  if (typeof real !== 'function') {
    continue;
  }
  let current = real;
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      return current;
    },
    set(value: unknown) {
      // Accept a real installed timer (e.g. `lynx.setTimeout`), but coerce any
      // non-function assignment back to the real environment timer so jsdom's
      // own teardown/async paths never see an `undefined`.
      current = typeof value === 'function' ? (value as typeof real) : real;
    },
  });
}

function isMockFunction(val: unknown): val is { mock: unknown; getMockName?: () => string } {
  return Boolean(
    typeof val === 'function'
      && val !== null
      && 'mock' in (val as object)
      && typeof (val as { mock?: unknown }).mock === 'object'
      && (val as { mock?: unknown }).mock !== null,
  );
}

// rstest's default mock name is `rstest.fn()`, which pretty-format prints as
// `[MockFunction rstest.fn()]`. The inline snapshots in this suite were captured
// under vitest, whose unnamed mocks print as `[MockFunction spy]`. Re-print
// unnamed mocks as `[MockFunction spy]` so the existing snapshots keep matching.
const UNNAMED_MOCK_NAMES = new Set(['', 'spy', 'rstest.fn()', 'vi.fn()']);

expect.addSnapshotSerializer({
  test(val: unknown) {
    if (!isMockFunction(val)) {
      return false;
    }
    const name = typeof val.getMockName === 'function' ? val.getMockName() : '';
    return UNNAMED_MOCK_NAMES.has(name);
  },
  print() {
    return '[MockFunction spy]';
  },
});
