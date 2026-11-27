// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// The `process` of the kit. This module creates the object when it loads;
// `installGlobals` (./globals.ts) makes it the `process` global only after
// @rspack/browser has started, because the wasm runtime of @rspack/browser
// takes a `process` global for a sign of Node.js. Code that imports `process`
// gets this object whether or not the global exists yet. `uptime()` and
// `hrtime()` count from when this module loads.

// The npm package; its `module.exports` is the class.
import EventEmitter from 'events/events.js';

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
const emitter = new EventEmitter();

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

/** Read and written through `process.exitCode`. */
export let exitCode: number | string | undefined;

const base = {
  __webBundleKit: true,
  title: 'web-bundle-kit',
  version: 'v24.0.0',
  // No `versions.node`: emnapi (under @rspack/browser) would take the
  // Worker for Node.js and reach for `worker_threads`.
  versions: {},
  platform: 'linux',
  arch: 'wasm32',
  pid: 1,
  ppid: 0,
  execArgv: [] as string[],
  argv: ['node', 'web-bundle-kit'],
  env: {} as Record<string, string | undefined>,
  get exitCode() {
    return exitCode;
  },
  set exitCode(code) {
    exitCode = code;
  },
  release: { name: 'node' },
  features: {},
  config: { variables: {} },
  stdout: stream(1),
  stderr: stream(2),
  stdin: { fd: 0, isTTY: false, on: () => {}, setRawMode: () => {} },
  cwd: () => currentDir,
  chdir: (dir: string) => {
    currentDir = dir;
  },
  umask: () => 0o22,
  getuid: () => -1,
  getgid: () => -1,
  uptime: () => (performance.now() - start) / 1000,
  hrtime: highResolutionTime,
  memoryUsage: Object.assign(
    () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
    {
      rss: () => 0,
    },
  ),
  cpuUsage: () => ({ user: 0, system: 0 }),
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
  kill: () => false,
  binding: () => ({}),
};

type EmitterMethod =
  | 'on'
  | 'once'
  | 'off'
  | 'removeAllListeners'
  | 'emit'
  | 'listeners'
  | 'listenerCount';
type EmitterArgs<K extends EmitterMethod> = Parameters<EventEmitter[K]>;

// Added to `base`, so `process.on(...)` can return the object it belongs to.
const process = Object.assign(base, {
  on: (...args: EmitterArgs<'on'>) => (emitter.on(...args), base),
  once: (...args: EmitterArgs<'once'>) => (emitter.once(...args), base),
  off: (...args: EmitterArgs<'off'>) => (emitter.off(...args), base),
  addListener: (...args: EmitterArgs<'on'>) => (emitter.on(...args), base),
  removeListener: (...args: EmitterArgs<'off'>) => (emitter.off(...args), base),
  removeAllListeners: (...args: EmitterArgs<'removeAllListeners'>) => (
    emitter.removeAllListeners(...args), base
  ),
  emit: (...args: EmitterArgs<'emit'>) => emitter.emit(...args),
  listeners: (name: EmitterArgs<'listeners'>[0]) => emitter.listeners(name),
  listenerCount: (name: EmitterArgs<'listenerCount'>[0]) =>
    emitter.listenerCount(name),
});

export const {
  __webBundleKit,
  title,
  version,
  versions,
  platform,
  arch,
  pid,
  ppid,
  execArgv,
  argv,
  env,
  release,
  features,
  config,
  stdout,
  stderr,
  stdin,
  cwd,
  chdir,
  umask,
  getuid,
  getgid,
  uptime,
  hrtime,
  memoryUsage,
  cpuUsage,
  nextTick,
  emitWarning,
  exit,
  kill,
  binding,
  on,
  once,
  off,
  addListener,
  removeListener,
  removeAllListeners,
  emit,
  listeners,
  listenerCount,
} = process;
export default process;
