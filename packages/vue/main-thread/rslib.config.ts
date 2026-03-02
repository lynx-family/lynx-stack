import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: true,
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    distPath: { root: 'dist' },
  },
})
