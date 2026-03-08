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
    // Bundled flat script – consumed by the rsbuild plugin as the raw
    // main-thread Lepus script (no webpack module-system wrapping needed).
    {
      format: 'esm',
      syntax: 'es2020',
      bundle: true,
      dts: false,
      source: {
        entry: {
          'main-thread-bundled': './src/entry-main.ts',
          'dev-worklet-registrations': './src/dev-worklet-registrations.ts',
        },
      },
      output: {
        distPath: { root: 'dist' },
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
