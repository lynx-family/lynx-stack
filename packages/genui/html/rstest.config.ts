// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

const config: RstestConfig = defineConfig({
  name: 'genui/html',
  globals: true,
  include: ['test/**/*.test.ts'],
});

export default config;
