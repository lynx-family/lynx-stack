import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: [
        './src/**',
        '!./src/**/__tests__/**',
      ],
    },
  },
  lib: [
    {
      bundle: false,
      format: 'esm',
      syntax: 'es2021',
      dts: true,
    },
    {
      bundle: false,
      format: 'cjs',
      syntax: 'es2021',
    },
  ],
});
