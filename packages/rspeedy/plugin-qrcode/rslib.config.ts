import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native'),
        ),
      },
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
      shortcuts: './src/shortcuts.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
})
