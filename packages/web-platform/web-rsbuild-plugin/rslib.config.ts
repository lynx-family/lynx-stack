import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: true,
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native'),
        ),
      },
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
