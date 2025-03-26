import { defineConfig } from '@rslib/core'
import { TypiaRspackPlugin } from 'typia-rspack-plugin'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: true },
  ],
  source: {
    entry: {
      'loaders/ignore-css-loader': './src/loaders/ignore-css-loader.ts',
      'loaders/invalid-import-error-loader':
        './src/loaders/invalid-import-error-loader.ts',
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  tools: {
    rspack: {
      plugins: [
        new TypiaRspackPlugin({ log: false }),
      ],
    },
  },
})
