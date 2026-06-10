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
  name: 'react-refresh-webpack-plugin',
  globals: true,
  include: ['test/**/*.{test,spec}.{js,ts}'],
  // Externalize only `@rspack/core` (rstest bundling it trips Node's "Cannot
  // require() ES Module @rspack/core ... not yet fully loaded"). Unlike the
  // template package, this package does not depend on `@rspack/test-tools` /
  // `@rspack/lite-tapable` directly, so those transitive imports must stay
  // bundled by rstest to resolve.
  output: {
    externals: [/^@rspack\/core/],
  },
  setupFiles: [
    require.resolve('@rspack/test-tools/setup-env'),
    require.resolve('@rspack/test-tools/setup-expect'),
    require.resolve('./test/setup-rstest.js'),
    require.resolve('./test/setup-env.js'),
  ],
  env: {
    RSPACK_HOT_TEST: 'true',
    __TEST_PATH__: testDir,
    __TEST_FIXTURES_PATH__: path.join(testDir, 'hotCases'),
    __TEST_DIST_PATH__: path.join(testDir, 'js'),
    __ROOT_PATH__: __dirname,
    __RSPACK_PATH__: rspackCore,
    __RSPACK_TEST_TOOLS_PATH__: rspackTestTools,
  },
};

const rstestConfig: ReturnType<typeof defineConfig> = defineConfig(config);

export default rstestConfig;
