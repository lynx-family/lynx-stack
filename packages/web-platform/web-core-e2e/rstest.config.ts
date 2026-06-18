// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as path from 'node:path';

import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'web-platform/web-core-e2e',
  resolve: {
    alias: {
      '@lynx-js/web-core/server': path.resolve(
        __dirname,
        '../web-core/ts/server/index.ts',
      ),
      '@lynx-js/web-core': path.resolve(
        __dirname,
        '../web-core/ts/client/index.ts',
      ),
    },
  },
  include: ['server-tests/**/*.test.ts'],
  testTimeout: 10000,
  tools: {
    rspack: {
      experiments: {
        asyncWebAssembly: true,
      },
      module: {
        // Leave `new URL('server_bg.wasm', import.meta.url)` untouched so it
        // resolves at runtime to the real on-disk file URL. Otherwise rspack
        // rewrites it to an emitted asset path that does not exist on disk
        // during in-memory test bundling, breaking the wasm `readFileSync`.
        parser: {
          javascript: { url: false },
        },
      },
    },
  },
});

export default config;
