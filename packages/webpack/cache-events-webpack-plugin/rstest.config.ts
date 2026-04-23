// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

const config: Parameters<typeof defineConfig>[0] = {
  name: 'cache-events-webpack-plugin',
  globals: true,
  include: ['test/**/*.test.ts'],
  setupFiles: [
    require.resolve('@rspack/test-tools/setup-env'),
    require.resolve('@rspack/test-tools/setup-expect'),
  ],
  env: {
    DEBUG: 'rspeedy',
    __TEST_PATH__: path.resolve(__dirname),
    __TEST_DIST_PATH__: path.resolve(__dirname, 'test', 'js'),
  },
};

const rstestConfig: ReturnType<typeof defineConfig> = defineConfig(config);

export default rstestConfig;
