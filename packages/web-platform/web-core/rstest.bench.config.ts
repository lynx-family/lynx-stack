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
  name: 'web-platform/web-core-bench',
  // Rstest has no `bench` API, so these files use tinybench for the measuring
  // and Rstest only for the module pipeline they need (TypeScript sources, the
  // jsdom shim and the wasm/CSS loaders below).
  include: ['./tests/*.bench.spec.ts'],
  testTimeout: 600_000,
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
