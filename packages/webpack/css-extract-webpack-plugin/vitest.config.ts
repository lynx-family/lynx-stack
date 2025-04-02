/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'webpack/css-extract',
    globalSetup: ['test/helper/setup-loader.js', 'test/helper/setup-dist.js'],
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
  },
  server: {
    watch: {
      ignored: './test/js',
    },
  },
});
