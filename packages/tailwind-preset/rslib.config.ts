import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      lynx: './src/lynx.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  lib: [
    {
      dts: {
        tsgo: true,
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native-preview'),
        ),
      },
      format: 'esm',
    },
    {
      format: 'cjs',
    },
  ],
});
