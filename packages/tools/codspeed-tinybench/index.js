// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getGitDir,
  getV8Flags,
  InstrumentHooks,
  mongoMeasurement,
  optimizeFunction,
  setupCore,
  teardownCore,
} from '@codspeed/core';

// Re-export `Bench` so bench files only depend on `@lynx-js/codspeed-tinybench`
// (no direct `tinybench` dependency needed in each benched package).
export { Bench } from 'tinybench';

/**
 * Run a tinybench `Bench` (tasks already added) under CodSpeed when
 * instrumented, else fall back to a normal tinybench walltime run.
 *
 * This mirrors `@codspeed/vitest-plugin`'s `analysis.mjs` runner so the repo's
 * benchmarks can run on plain Node (no vitest), while keeping CodSpeed
 * reporting when executed under a CodSpeed runner.
 *
 * @param {import('tinybench').Bench} bench
 * @param {string} benchFileUrl - `import.meta.url` of the calling bench file
 *   (used to build the CodSpeed benchmark URI).
 */
export async function withCodSpeed(bench, benchFileUrl) {
  if (!InstrumentHooks.isInstrumented()) {
    await bench.run();
    console.table(bench.table());
    return;
  }

  // Under a CodSpeed runner, instrumentation needs V8 flags on the node process
  // (notably `--allow-natives-syntax`, without which `optimizeFunction`'s
  // `%OptimizeFunctionOnNextCall` is a SyntaxError). Plain `node bench.js` is
  // launched without them, so re-exec this same file in a child that carries
  // the flags — mirroring how `@codspeed/vitest-plugin` spawns its workers with
  // `execArgv: getV8Flags()`.
  const requiredFlags = getV8Flags();
  const missingFlags = requiredFlags.filter(
    (flag) => !process.execArgv.includes(flag),
  );
  if (missingFlags.length > 0) {
    const child = spawnSync(
      process.execPath,
      [...requiredFlags, ...process.execArgv, ...process.argv.slice(1)],
      { stdio: 'inherit' },
    );
    process.exit(child.status ?? 1);
  }

  const filePath = fileURLToPath(benchFileUrl);
  const gitDir = getGitDir(filePath);
  if (gitDir === undefined) {
    throw new Error('[CodSpeed] could not find a git repository');
  }
  const suiteName = path.relative(gitDir, filePath);

  setupCore();
  try {
    for (const task of bench.tasks) {
      const uri = `${suiteName}::${task.name}`;
      const fn = task.fn;
      await optimizeFunction(async () => {
        await fn();
      });
      await mongoMeasurement.start(uri);
      globalThis.gc?.();
      await (async function __codspeed_root_frame__() {
        InstrumentHooks.startBenchmark();
        await fn();
        InstrumentHooks.stopBenchmark();
        InstrumentHooks.setExecutedBenchmark(process.pid, uri);
      })();
      await mongoMeasurement.stop(uri);
      console.log(`[CodSpeed] ${uri} done`);
    }
  } finally {
    teardownCore();
  }
}
