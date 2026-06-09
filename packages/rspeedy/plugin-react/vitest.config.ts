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
    // These tests build fixtures through `createRspeedy().build()`, which now runs
    // the default type checker on each build — enough extra work to exceed the
    // default 5s timeout on slower machines.
    testTimeout: 30_000,
  },
})

export default config
