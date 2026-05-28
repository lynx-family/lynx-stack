// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { join } from 'node:path'

import typescript from '@rollup/plugin-typescript'
import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'rspeedy/debug-metadata-plugin',
    globals: true,
  },
  plugins: [
    typescript({
      rootDir: 'src',
      inlineSourceMap: true,
      inlineSources: true,
      incremental: false,
      sourceRoot: join(__dirname, 'src'),
      composite: false,
      tsconfig: join(__dirname, './tsconfig.build.json'),
    }),
  ],
})

export default config
