// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core'
import type { RstestConfig } from '@rstest/core'

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config'

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy/react',
    url: import.meta.url,
    setupFiles: ['@lynx-js/test-tools/setup-rspeedy'],
    // vitest defaulted NODE_ENV to 'test'; rstest leaves it unset and rsbuild
    // would treat builds as production (hashed filenames).
    env: { NODE_ENV: 'test' },
  }),
  tools: {
    rspack: {
      // This `tools` overrides the preset's — keep its `url: false` here.
      module: {
        parser: { javascript: { url: false } },
      },
    },
  },
})

export default config
