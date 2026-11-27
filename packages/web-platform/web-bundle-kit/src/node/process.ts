// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// The `process` of the kit: the `process` package, which pluginNodePolyfill
// uses, with the members bundled code reads that it lacks. This module
// creates the object when it loads; `installGlobals` (./globals.ts) makes
// it the `process` global only after @rspack/browser has started, because
// the wasm runtime of @rspack/browser takes a `process` global for a sign of
// Node.js. `hrtime()` counts from when this module loads.
//
// The package has no `versions.node`: emnapi (under @rspack/browser) would
// take the Worker for Node.js and reach for `worker_threads`.

import process from 'process/browser.js';

type Callback = (...args: unknown[]) => void;

/** `process.stdout` and `process.stderr`, written to the console. */
const stream = (fd: number) => ({
  fd,
  isTTY: false,
  columns: 80,
  rows: 24,
  write: (chunk: unknown, _encoding?: unknown, callback?: unknown) => {
    const text = String(chunk).replace(/\n$/, '');
    if (fd === 2) console.error(text);
    else console.log(text);
    if (typeof callback === 'function') (callback as Callback)();
    else if (typeof _encoding === 'function') (_encoding as Callback)();
    return true;
  },
  on: () => {},
  once: () => {},
  off: () => {},
  end: () => {},
  hasColors: () => false,
  getColorDepth: () => 1,
});

let currentDir = '/';
const start = performance.now();

function highResolutionTime(previous?: [number, number]): [number, number] {
  const now = performance.now() - start;
  const seconds = Math.floor(now / 1000);
  const nanos = Math.floor((now % 1000) * 1e6);
  if (!previous) return [seconds, nanos];
  let ds = seconds - previous[0];
  let dn = nanos - previous[1];
  if (dn < 0) {
    ds -= 1;
    dn += 1e9;
  }
  return [ds, dn];
}
highResolutionTime.bigint = () =>
  BigInt(Math.floor((performance.now() - start) * 1e6));

// A copy without `browser: true`, which would send packages that test it
// (debug, the streams of @rspack/browser) to their browser code.
const { browser: _browser, ...polyfill } = process;

export default {
  ...polyfill,
  version: 'v24.0.0',
  platform: 'linux',
  arch: 'wasm32',
  pid: 1,
  execArgv: [] as string[],
  argv: ['node', 'web-bundle-kit'],
  features: {},
  stdout: stream(1),
  stderr: stream(2),
  stdin: { fd: 0, isTTY: false, on: () => {}, setRawMode: () => {} },
  cwd: () => currentDir,
  chdir: (dir: string) => {
    currentDir = dir;
  },
  getuid: () => -1,
  getgid: () => -1,
  hrtime: highResolutionTime,
  memoryUsage: Object.assign(
    () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
    { rss: () => 0 },
  ),
  // The package runs callbacks from a timer.
  nextTick: (fn: Callback, ...args: unknown[]) =>
    queueMicrotask(() => fn(...args)),
  emitWarning: (warning: unknown) =>
    console.warn(
      String(
        (warning as { message?: unknown } | undefined)?.message ?? warning,
      ),
    ),
  exit: (code?: number) => {
    throw new Error(
      `process.exit(${code ?? ''}) was called in @lynx-js/web-bundle-kit`,
    );
  },
};
