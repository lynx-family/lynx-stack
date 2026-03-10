import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    // Unbundled ESM – webpack imports entry-main.ts as a regular module
    // on the main-thread layer. The old flat-bundle build is no longer needed
    // since VueMarkMainThreadPlugin no longer replaces webpack-generated content.
    {
      format: 'esm',
      syntax: 'es2022',
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
});
