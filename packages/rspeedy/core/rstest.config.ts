// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rstest/core'
import type { RstestConfig } from '@rstest/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config'

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const engineSrc = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../plugin-lynx/src',
)

const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy',
    url: import.meta.url,
    setupFiles: ['@lynx-js/test-tools/setup-rspeedy'],
    // vitest defaulted NODE_ENV to 'test'; rstest leaves it unset and rsbuild
    // would treat builds as production (hashed filenames).
    env: { NODE_ENV: 'test' },
  }),
  resolve: {
    alias: {
      // Some tests mock the engine's source modules (e.g. the webpack
      // helpers). `applyDefaultPlugins` loads the engine through the package
      // specifier, which would otherwise resolve to the built `lib/` and
      // break mock identity — alias the package back to `src/` so the plugin
      // under test and the mock share a single module instance.
      '@lynx-js/rsbuild-plugin/internal': path.join(engineSrc, 'internal.ts'),
      '@lynx-js/rsbuild-plugin': path.join(engineSrc, 'index.ts'),
    },
  },
  // Expand `src`'s typia macros; `include` keeps typia away from other
  // packages' compiled output (see rspeedy/plugin-config).
  tools: {
    rspack: {
      // This `tools` overrides the preset's — keep its `url: false` here.
      module: { parser: { javascript: { url: false } } },
      plugins: [
        new TypiaRspackPlugin({
          include: [
            path.join(path.dirname(fileURLToPath(import.meta.url)), 'src'),
          ],
        }),
      ],
    },
  },
})

export default config
