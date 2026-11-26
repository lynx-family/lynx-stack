// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worker } from 'node:worker_threads';

import { expect, test } from '@rstest/core';

// Node.js emits `worker` on the next tick after a worker thread is created.
const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

test('importing the plugin starts no TASM encode worker', async () => {
  const workers: Worker[] = [];
  const onWorker = (worker: Worker) => workers.push(worker);
  process.on('worker', onWorker);

  try {
    // Imported here, after the listener, so its module evaluation is observed.
    const { LynxEncodePlugin } = await import('../src/index.js');
    await nextTurn();
    expect(workers).toHaveLength(0);

    const pool = LynxEncodePlugin.encodePool;
    expect(LynxEncodePlugin.encodePool).toBe(pool);
    await nextTurn();
    expect(workers.length).toBeGreaterThan(0);

    await pool.destroy();
  } finally {
    process.off('worker', onWorker);
  }
});
