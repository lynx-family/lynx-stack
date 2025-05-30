import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: false },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
    alias: {
      '@': './src',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    distPath: {
      root: './lib',
    },
    filename: {
      js: '[name].js',
    },
    cleanDistPath: true,
  },
})
