// @ts-nocheck
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './index.js',
      index2: './index2.js',
    },
  },
  output: {
    polyfill: 'off',
    module: true,
  },
});
