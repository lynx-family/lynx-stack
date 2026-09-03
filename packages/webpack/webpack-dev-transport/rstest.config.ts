// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  name: 'webpack/dev-transport',
  include: ['test/**/*.test.ts'],
  resolve: {
    mainFields: ['module', 'main'],
  },
  // `client/**` is written against the webpack runtime, so `__resourceQuery`,
  // `__webpack_hash__` and `__webpack_require__` are free identifiers that
  // rspack substitutes at build time. The tests instead drive them through
  // `rs.stubGlobal`, which build-time substitution makes unreachable. Redirect
  // the three back to the globals so the stubs take effect. Test-build only —
  // production bundles still get the real runtime values.
  source: {
    define: {
      __resourceQuery: 'globalThis.__resourceQuery',
      __webpack_hash__: 'globalThis.__webpack_hash__',
      __webpack_require__: 'globalThis.__webpack_require__',
    },
  },
});
