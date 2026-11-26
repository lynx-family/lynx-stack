// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The Node.js globals that bundled packages use: `process`, `Buffer`,
// `global` and `setImmediate`. Installed once, before any of them is loaded.

const { EventEmitter } = require('events/events.js');

const { Buffer } = require('./buffer.cjs');

/** `process.stdout` and `process.stderr`, written to the console. */
const stream = (fd) => ({
  fd,
  isTTY: false,
  columns: 80,
  rows: 24,
  write: (chunk, _encoding, callback) => {
    const text = String(chunk).replace(/\n$/, '');
    if (fd === 2) console.error(text);
    else console.log(text);
    if (typeof callback === 'function') callback();
    else if (typeof _encoding === 'function') _encoding();
    return true;
  },
  on: () => {},
  once: () => {},
  off: () => {},
  end: () => {},
  hasColors: () => false,
  getColorDepth: () => 1,
});

function installGlobals(cwd) {
  const g = globalThis;
  g.global ??= g;
  g.Buffer ??= Buffer;
  g.setImmediate ??= (fn, ...args) => setTimeout(fn, 0, ...args);
  g.clearImmediate ??= (id) => clearTimeout(id);
  if (g.process?.__webBundleKit) {
    g.process.chdir(cwd);
    return g.process;
  }

  let currentDir = cwd;
  const start = performance.now();
  const emitter = new EventEmitter();
  const hrtime = (previous) => {
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
  };
  hrtime.bigint = () => BigInt(Math.floor((performance.now() - start) * 1e6));

  const process = {
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
    execArgv: [],
    argv: ['node', 'web-bundle-kit'],
    env: {},
    exitCode: undefined,
    release: { name: 'node' },
    features: {},
    config: { variables: {} },
    stdout: stream(1),
    stderr: stream(2),
    stdin: { fd: 0, isTTY: false, on: () => {}, setRawMode: () => {} },
    cwd: () => currentDir,
    chdir: (dir) => {
      currentDir = dir;
    },
    umask: () => 0o22,
    getuid: () => -1,
    getgid: () => -1,
    uptime: () => (performance.now() - start) / 1000,
    hrtime,
    memoryUsage: Object.assign(
      () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
      {
        rss: () => 0,
      },
    ),
    cpuUsage: () => ({ user: 0, system: 0 }),
    nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
    emitWarning: (warning) => console.warn(String(warning?.message ?? warning)),
    exit: (code) => {
      throw new Error(
        `process.exit(${code ?? ''}) was called in @lynx-js/web-bundle-kit`,
      );
    },
    kill: () => false,
    binding: () => ({}),
    on: (...args) => (emitter.on(...args), process),
    once: (...args) => (emitter.once(...args), process),
    off: (...args) => (emitter.off(...args), process),
    addListener: (...args) => (emitter.on(...args), process),
    removeListener: (...args) => (emitter.off(...args), process),
    removeAllListeners: (
      ...args
    ) => (emitter.removeAllListeners(...args), process),
    emit: (...args) => emitter.emit(...args),
    listeners: (name) => emitter.listeners(name),
    listenerCount: (name) => emitter.listenerCount(name),
  };
  g.process = process;
  return process;
}

module.exports = { installGlobals };
