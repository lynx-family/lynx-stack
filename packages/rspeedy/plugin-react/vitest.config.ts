import path, { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import typescript from '@rollup/plugin-typescript'
import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config: UserWorkspaceConfig = defineProject({
  plugins: [
    typescript({
      rootDir: 'src',
      inlineSourceMap: true,
      inlineSources: true,
      sourceRoot: join(__dirname, 'src'),
      incremental: true,
      composite: true,
      tsconfig: path.join(__dirname, './tsconfig.build.json'),
    }),
  ],

  test: {
    name: 'rspeedy/react',
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
    // These tests build fixtures through `createRspeedy().build()` to assert
    // bundling behavior — they don't type-check (and some fixtures intentionally
    // fail to build). Skip the default type checker to avoid the per-build
    // overhead (and timeouts) it would otherwise add.
    env: {
      RSPEEDY_TYPE_CHECK: 'false',
    },
  },
})

export default config
