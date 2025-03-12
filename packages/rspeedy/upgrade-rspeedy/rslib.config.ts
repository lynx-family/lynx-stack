import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022' },
  ],
  source: {
    entry: {
      'upgrade-rspeedy': './src/upgrade-rspeedy.ts',
    },
  },
})
