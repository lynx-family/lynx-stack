import { join } from 'node:path'
import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'
import typescript from '@rollup/plugin-typescript'

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'rspeedy/config',
    env: {
      DEBUG: 'rspeedy',
    },
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
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
