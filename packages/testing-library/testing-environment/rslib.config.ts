import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

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
      dts: {
        tsgo: true,
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native-preview'),
        ),
      },
    },
    {
      bundle: false,
      format: 'cjs',
      syntax: 'es2021',
    },
  ],
  plugins: [
    pluginPublint(),
  ],
});
