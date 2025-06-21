import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true } },
  ],
  source: {
    entry: {
      'index': './src/runtime/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
})
