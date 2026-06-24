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
  name: 'web-platform',
  include: ['tests/**/*.{test,spec}.ts'],
  testTimeout: 30_000,
  env: {
    NODE_ENV: 'test',
  },
  tools: {
    rspack: {
      module: {
        parser: { javascript: { url: false } },
      },
    },
  },
});

export default config;
