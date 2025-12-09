// @ts-nocheck
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './index.ts',
    },
  },
  output: {
    polyfill: 'off',
  },
});
