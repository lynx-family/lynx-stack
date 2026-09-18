import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true, tsgo: false } },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    externals: [
      '@lynx-js/runtime-wrapper-webpack-plugin',
      '@lynx-js/template-webpack-plugin',
      '@rsbuild/core',
    ],
  },
})
