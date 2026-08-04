import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';

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
    },
  ],
  plugins: [
    pluginPublint(),
  ],
});
