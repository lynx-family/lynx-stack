import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
    },
  ],
  source: {
    entry: {
      index: './index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
});
