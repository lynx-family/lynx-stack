// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'test');
const rspackTestTools = path.dirname(
  require.resolve('@rspack/test-tools/package.json'),
);
const rspackCore = path.dirname(require.resolve('@rspack/core/package.json'));

const config: Parameters<typeof defineConfig>[0] = {
  name: 'runtime-wrapper-webpack-plugin',
  globals: true,
  include: ['test/**/*.{test,spec}.{js,ts}'],
  output: {
    externals: [/^@rspack\//],
  },
  setupFiles: [
    require.resolve('@rspack/test-tools/setup-env'),
    require.resolve('@rspack/test-tools/setup-expect'),
  ],
  unstubGlobals: true,
  env: {
    RSPACK_HOT_TEST: 'true',
    __TEST_PATH__: testDir,
    __TEST_FIXTURES_PATH__: path.join(testDir, 'cases'),
    __TEST_DIST_PATH__: path.join(testDir, 'dist'),
    __ROOT_PATH__: __dirname,
    __RSPACK_PATH__: rspackCore,
    __RSPACK_TEST_TOOLS_PATH__: rspackTestTools,
  },
};

const rstestConfig: ReturnType<typeof defineConfig> = defineConfig(config);

export default rstestConfig;
