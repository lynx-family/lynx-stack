// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

import { lynxRstestConfig } from '@lynx-js/test-tools/lib/rstest-config.js';

export default defineConfig({
  ...lynxRstestConfig({
    name: 'webpack/css-extract',
    url: import.meta.url,
    fixtures: 'hotCases',
    // Top-level only: `test/cases/**` holds `errors.test.js` case files that
    // must not be collected as test suites.
    include: ['test/*.test.{js,ts}'],
    externals: [
      // The standalone webpack-case suite runs real webpack.
      'webpack',
      // Self-reference resolves to the built `lib` via plain Node, so the test
      // files and the natively-imported case `webpack.config.js` files share
      // the SAME plugin module instances (`instanceof` checks hold).
      '@lynx-js/css-extract-webpack-plugin',
      // The HMR runtime references `__webpack_require__`, which is a reserved
      // identifier inside rspack-bundled code (it would be rewritten to the
      // bundler's own require, breaking `rstest.stubGlobal`); load it natively.
      /runtime\/hotModuleReplacement\.cjs$/,
    ],
  }),
  globalSetup: ['./test/helper/setup-loader.js', './test/helper/setup-dist.js'],
});
