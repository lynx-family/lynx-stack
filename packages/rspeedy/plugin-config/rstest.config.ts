// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rstest/core'
import type { RstestConfig } from '@rstest/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

import { lynxRstestConfig } from '@lynx-js/test-tools/lib/rstest-config.js'

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy/config',
    url: import.meta.url,
    fixtures: 'cases',
    dist: 'dist',
  }),
  // `src/validate.ts` uses the `typia.createValidateEquals<T>()` macro, which
  // must be expanded at build time (same plugin the `rslib` build uses, where
  // `@lynx-js/rspeedy` is auto-externalized so its `lib` never enters the
  // bundle). Under rstest the workspace deps ARE bundled, so scope the
  // transformer to this package's `src`: the default include would also run it
  // over other workspace packages' already-expanded `lib` output (e.g.
  // `@lynx-js/rspeedy`'s `lib/config/validate.js`), and the loader's
  // single-file `ts.createProgram` cannot resolve those files' imports —
  // the unresolved symbols crash the TypeScript checker
  // ("Cannot read properties of undefined (reading 'flags')").
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
