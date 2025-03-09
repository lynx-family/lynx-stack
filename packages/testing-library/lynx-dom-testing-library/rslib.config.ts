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
      format: 'cjs',
      syntax: 'es2021',
    },
  ],
});
