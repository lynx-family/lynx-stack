// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config';

// Explicitly typed: `--isolatedDeclarations` cannot infer default exports.
const config: RstestConfig = defineConfig(lynxRstestConfig({
  name: 'webpack/react',
  url: import.meta.url,
  fixtures: 'cases',
  dist: 'dist',
  exclude: ['test/cases/**', 'test/dist/**'],
  setupFiles: ['./test/setup-env.js'],
}));

export default config;
