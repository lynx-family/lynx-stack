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
    name: 'rspeedy/lynx-bundle-rslib-config',
    url: import.meta.url,
    setupFiles: ['@lynx-js/test-tools/setup-rspeedy'],
    // rstest leaves NODE_ENV unset, so set it explicitly; otherwise rsbuild
    // would treat builds as production (hashed filenames).
    env: { NODE_ENV: 'test' },
  }),
})

export default config
