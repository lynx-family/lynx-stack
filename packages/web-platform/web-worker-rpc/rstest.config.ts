// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

const root = path.dirname(fileURLToPath(import.meta.url));

const config: RstestConfig = defineConfig({
  root,
  name: 'web-worker-rpc',
  include: ['test/**/*.test.ts'],
  testTimeout: 10_000,
  // `test/rpc.test.ts` starts a real `node:worker_threads` Worker. Point it at
  // the on-disk source rather than a bundled chunk: `test/worker.js` and the
  // `test/endpoints.js` it pulls in are plain ESM over the built `dist`, so
  // Node loads them as-is. Relying on the emitted chunk instead would require
  // `dev.writeToDisk`, which is silently dropped once enough projects share a
  // single Rsbuild instance under the root config.
  source: {
    define: {
      __WORKER_ENTRY__: JSON.stringify(path.join(root, 'test', 'worker.js')),
    },
  },
});

export default config;
