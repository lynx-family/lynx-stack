import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      source: {
        entry: {
          index: './src/index.ts',
          // Seam consumed by the `@lynx-js/rspeedy` CLI. See `src/internal.ts`.
          internal: './src/internal.ts',
        },
      },
      dts: { bundle: true },
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
})
