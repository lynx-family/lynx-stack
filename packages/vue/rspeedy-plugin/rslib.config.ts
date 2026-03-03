import { defineConfig } from '@rslib/core';

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
      'loaders/ignore-css-loader': './src/loaders/ignore-css-loader.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    externals: [
      '@rsbuild/core',
      '@rsbuild/plugin-vue',
      '@lynx-js/runtime-wrapper-webpack-plugin',
      '@lynx-js/template-webpack-plugin',
      '@lynx-js/vue-runtime',
      '@lynx-js/vue-main-thread',
    ],
    distPath: { root: 'dist' },
  },
});
