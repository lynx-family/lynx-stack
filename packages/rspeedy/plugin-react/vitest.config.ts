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

    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.typecheck.json',
    },
  },
})

export default config
