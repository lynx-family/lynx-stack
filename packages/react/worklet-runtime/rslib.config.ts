import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/**',
    },
  },
  lib: [
    {
      bundle: false,
      format: 'esm',
      syntax: 'es2021',
      dts: true,
    },
  ],
  output: {
    distPath: {
      root: './lib',
    },
    sourceMap: true,
  },
});
