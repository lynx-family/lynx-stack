import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      // bundle: false means rslib transpiles each file individually.
      // This is critical: without it, webpack cannot deduplicate the shared
      // singletons (event-registry, app-registry ops buffer) between
      // index.js and entry-background.js.
      bundle: false,
      dts: true,
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    distPath: { root: 'dist' },
  },
})
