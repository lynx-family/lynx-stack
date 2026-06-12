// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly typed: `--isolatedDeclarations` cannot infer default exports.
const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'webpack/css-extract',
    url: import.meta.url,
    fixtures: 'hotCases',
    // Top-level only: `test/cases/**` holds `errors.test.js` case files that
    // must not be collected as test suites.
    include: ['test/*.test.{js,ts}'],
    externals: [
      // The HMR runtime references `__webpack_require__`, which is a reserved
      // identifier inside rspack-bundled code (it would be rewritten to the
      // bundler's own require, breaking `rstest.stubGlobal`); load it natively.
      // Mapped to an absolute path: the relative request is otherwise resolved
      // against rstest's output dir at runtime.
      {
        '../runtime/hotModuleReplacement.cjs': `node-commonjs ${
          path.join(__dirname, 'runtime/hotModuleReplacement.cjs')
        }`,
      },
    ],
  }),
  globalSetup: ['./test/helper/setup-dist.js'],
});

export default config;
