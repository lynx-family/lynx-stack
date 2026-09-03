// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test } from '@rstest/core';
import { Bench } from 'tinybench';

export type AddBenchmark = (name: string, fn: () => unknown) => void;

/**
 * Runs a group of benchmarks.
 *
 * Rstest has no `bench` API, so the measuring is done by tinybench while
 * Rstest only supplies the module pipeline these files need (TypeScript
 * sources, the jsdom shim, and the wasm/CSS loaders configured in
 * `rstest.bench.config.ts`).
 *
 * Deliberately NOT wrapped in `@codspeed/tinybench-plugin`'s `withCodSpeed`:
 * it introspects at import time by re-execing the process with V8 flags and
 * calling `process.exit(0)`, which Rstest intercepts and reports as a failed
 * test file. These two suites are therefore run but not tracked by CodSpeed —
 * the same tracking status they had before, when nothing ran them at all. The
 * standalone Node benchmarks (`react/transform`, `web-core-e2e`) are wrapped,
 * since they are plain scripts where the re-exec works.
 */
export function describeBench(
  name: string,
  define: (bench: AddBenchmark) => void | Promise<void>,
): void {
  test(name, async () => {
    const bench = new Bench({ name });
    await define((taskName, fn) => {
      bench.add(`${name} > ${taskName}`, fn);
    });
    await bench.run();
    console.table(bench.table());
  }, 600_000);
}
