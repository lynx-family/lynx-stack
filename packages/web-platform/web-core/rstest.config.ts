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
  name: 'web-platform/web-core',
  include: ['./tests/*.spec.ts'],
  exclude: ['./tests/*.bench.spec.ts'],
  testTimeout: 10_000,
  coverage: {
    include: ['ts/**', 'src/**'],
  },
  tools: {
    rspack: {
      module: {
        parser: { javascript: { url: false } },
        rules: [
          {
            resource: path.join(root, 'ts/client/wasm.ts'),
            use: [
              path.join(root, 'tests/loaders/debug-wasm-loader.mjs'),
            ],
          },
          {
            resource: /in_shadow\.css$/,
            resourceQuery: /inline/,
            type: 'javascript/auto',
            use: [
              path.join(root, 'tests/loaders/in-shadow-css-loader.mjs'),
            ],
          },
        ],
      },
    },
  },
});

export default config;
