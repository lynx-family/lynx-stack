import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    // Unbundled ESM – used for TypeScript consumers and type declarations
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: true,
    },
    // Bundled flat script (production) – __DEV__ = false, minified.
    {
      format: 'esm',
      syntax: 'es2020',
      bundle: true,
      dts: false,
      source: {
        define: { __DEV__: 'false' },
        entry: { 'main-thread-bundled': './src/entry-main.ts' },
      },
      output: {
        distPath: { root: 'dist' },
        minify: true,
      },
    },
    // Bundled flat script (development) – __DEV__ = true, source-mapped.
    {
      format: 'esm',
      syntax: 'es2020',
      bundle: true,
      dts: false,
      source: {
        define: { __DEV__: 'true' },
        entry: { 'main-thread-bundled.dev': './src/entry-main.ts' },
      },
      output: {
        distPath: { root: 'dist' },
        sourceMap: { js: 'inline-source-map' },
      },
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    distPath: { root: 'dist' },
  },
});
