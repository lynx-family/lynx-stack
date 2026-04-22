// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);

export default defineConfig({
  globals: true,
  include: ['test/**/*.test.ts'],
  setupFiles: [
    require.resolve('@rspack/test-tools/setup-env'),
    require.resolve('@rspack/test-tools/setup-expect'),
  ],
  unstubGlobals: true,
});
