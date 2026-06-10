// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rstest/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

import { lynxRstestConfig } from '@lynx-js/test-tools/lib/rstest-config.js'

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: ReturnType<typeof defineConfig> = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy/config',
    url: import.meta.url,
    fixtures: 'cases',
    dist: 'dist',
  }),
  // `src/validate.ts` uses the `typia.createValidateEquals<T>()` macro, which
  // must be expanded at build time (same plugin the `rslib` build uses).
  // Scoped to this package's `src`: the default include would also run the
  // transformer over other workspace packages' compiled `lib` output (e.g.
  // `@lynx-js/rspeedy`'s), which crashes the TypeScript checker.
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
