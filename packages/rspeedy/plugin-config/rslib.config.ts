import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2022', dts: { bundle: true } },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
})
