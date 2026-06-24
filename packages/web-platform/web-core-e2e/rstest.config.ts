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
  name: 'web-platform/web-core-e2e',
  include: ['server-tests/**/*.test.ts'],
  exclude: ['bench/**/*.bench.vitest.spec.ts'],
  testTimeout: 10_000,
  resolve: {
    alias: {
      '@lynx-js/web-core/server': path.resolve(
        root,
        '../web-core/ts/server/deploy.ts',
      ),
      '@lynx-js/web-core': path.resolve(
        root,
        '../web-core/ts/client/index.ts',
      ),
    },
  },
  tools: {
    rspack: {
      module: {
        parser: { javascript: { url: false } },
        rules: [
          {
            resourceQuery: /inline/,
            type: 'asset/source',
          },
        ],
      },
    },
  },
});

export default config;
