import { test, expect } from '@rstest/core';
import * as path from 'path';
import * as fs from 'fs';
import { executeTemplate } from '@lynx-js/web-core/server';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `executeTemplate` builds its element tree inside the wasm linear memory,
 * which the JS GC cannot reclaim. Before the context was freed explicitly each
 * call retained its whole tree — ~340KB per render of `div-1000`, growing
 * without bound in any long-running SSR process, and enough to make the
 * benchmark of this same function swing by 20-30% run over run.
 *
 * `process.memoryUsage().external` counts the wasm memory, so a leak shows up
 * as linear growth here. The threshold is deliberately loose: the regression
 * this guards against was three orders of magnitude larger.
 */
test('executeTemplate should not retain wasm memory across calls', () => {
  const buffer = fs.readFileSync(
    path.resolve(__dirname, '../dist/basic-performance-div-1000.web.bundle'),
  );

  // Let the wasm instance reach its steady-state size first: the very first
  // renders still grow the linear memory for allocator pages that get reused.
  for (let i = 0; i < 20; i++) {
    executeTemplate(buffer, {}, {}, {});
  }

  const before = process.memoryUsage().external;
  const iterations = 50;
  for (let i = 0; i < iterations; i++) {
    executeTemplate(buffer, {}, {}, {});
  }
  const retainedPerCall = (process.memoryUsage().external - before)
    / iterations;

  // Leaking looked like ~340_000 bytes per call for this bundle.
  expect(retainedPerCall).toBeLessThan(50_000);
});
