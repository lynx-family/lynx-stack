// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'webpack/dev-transport',
  globals: true,
  resolve: {
    mainFields: ['module', 'main'],
  },
  source: {
    // The client reads webpack runtime magic globals (`__resourceQuery`,
    // `__webpack_hash__`, `__webpack_require__`) as free identifiers. rspack
    // would otherwise replace them at build time (with the test module's empty
    // query / build hash / its own runtime require), defeating the suites that
    // drive them via `rstest.stubGlobal`. Map them to `globalThis` so the
    // stubbed values flow through at runtime.
    define: {
      __resourceQuery: 'globalThis.__resourceQuery',
      __webpack_hash__: 'globalThis.__webpack_hash__',
      __webpack_require__: 'globalThis.__webpack_require__',
    },
  },
});

export default config;
