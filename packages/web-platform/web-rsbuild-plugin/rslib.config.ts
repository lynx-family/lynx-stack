import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: { bundle: true, tsgo: true },
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
    },
    {
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      source: {
        entry: {
          'loaders/native-modules': './src/loaders/native-modules.ts',
          'loaders/napi-modules': './src/loaders/napi-modules.ts',
        },
      },
    },
  ],
});
