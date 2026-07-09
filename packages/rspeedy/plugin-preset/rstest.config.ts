// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rstest/core'
import type { RstestConfig } from '@rstest/core'

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config'

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src')

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'preset',
    url: import.meta.url,
    env: { NODE_ENV: 'test' },
  }),
  resolve: {
    alias: {
      // Some tests mock preset's own source modules (e.g. the webpack helpers).
      // `createRspeedy` loads the plugins through the package specifier, which
      // would otherwise resolve to the built `lib/` and break mock identity —
      // alias the package back to `src/` so the plugin under test and the mock
      // share a single module instance.
      '@lynx-js/preset-rsbuild-plugin/internal': path.join(src, 'internal.ts'),
      '@lynx-js/preset-rsbuild-plugin': path.join(src, 'index.ts'),
    },
  },
})

export default config
