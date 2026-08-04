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
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native'),
        ),
      },
      format: 'esm',
    },
    {
      format: 'cjs',
    },
  ],
});
