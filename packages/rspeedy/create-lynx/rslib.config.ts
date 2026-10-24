import type { RslibConfig } from '@rslib/core'
import { defineConfig } from '@rslib/core'

const config: RslibConfig = defineConfig({
  source: {
    tsconfigPath: './tsconfig.build.json',
    entry: {
      index: './src/index.ts',
      create: './src/create.ts',
    },
  },
  lib: [
    { format: 'esm', syntax: 'es2021', dts: true },
  ],
})

export default config
