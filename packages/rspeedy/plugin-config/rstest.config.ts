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
const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy/config',
    url: import.meta.url,
  }),
  // Expand `src`'s typia macros (rslib does this too, but auto-externals the
  // workspace deps). `include` is required: without it typia also processes
  // `rspeedy/core/lib/config/validate.js`, fails to resolve symbols there and
  // crashes.
  tools: {
    rspack: {
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
