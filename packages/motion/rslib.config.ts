import { defineConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';
import { pluginMotionRuntime } from './build/pluginMotionRuntime.js';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      bundle: false,
      source: {
        entry: { index: ['./src/**', '!./src/upstream/**'] },
      },
    },
    {
      id: 'upstream',
      format: 'esm',
      syntax: 'es2022',
      bundle: true,
      source: {
        entry: {
          'upstream/full': './src/upstream/full.ts',
          'upstream/mini': './src/upstream/mini.ts',
        },
      },
      output: {
        autoExternal: { dependencies: false },
      },
      plugins: [pluginMotionRuntime()],
    },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
  plugins: [pluginPublint()],
  performance: {
    buildCache: false,
  },
});
