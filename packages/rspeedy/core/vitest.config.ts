import { join } from 'node:path'

import typescript from '@rollup/plugin-typescript'
import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const config: UserWorkspaceConfig = defineProject({
  esbuild: {
    // See: https://github.com/vitejs/vite/discussions/14327
    target: 'es2022',
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
  test: {
    typecheck: {
      ignoreSourceErrors: true,
      include: ['test/**/*.test-d.ts'],
    },
    name: 'rspeedy',
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
    env: {
      DEBUG: 'rspeedy',

      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    pool: 'forks',
  },
})

export default config
