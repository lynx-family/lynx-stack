import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: true,
      dts: { bundle: true, tsgo: false },
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    externals: [
      '@rsbuild/core',
      '@lynx-js/runtime-wrapper-webpack-plugin',
      '@lynx-js/template-webpack-plugin',
      '@lynx-js/vue-runtime',
      '@lynx-js/vue-main-thread',
    ],
    distPath: { root: 'dist' },
  },
})
