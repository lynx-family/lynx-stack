import { defineConfig } from '@rslib/core';
import type { Rsbuild, RslibConfig } from '@rslib/core';
import { pluginPublint } from 'rsbuild-plugin-publint';
import { pluginLynxRuntime } from './build/pluginLynxRuntime.js';

const config: RslibConfig = defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: {
          bundledPackages: [
            'motion',
            'motion-dom',
            'motion-utils',
            'framer-motion',
          ],
        },
      },
      bundle: false,
      source: {
        entry: { index: ['./src/**', '!./src/upstream/**'] },
      },
      plugins: [{
        name: 'lynx:motion-declaration-entries',
        setup(api) {
          // Bundleless JS uses Rslib's glob-based Rspack entries. Its declaration
          // bundler separately needs explicit public entry points.
          api.modifyEnvironmentConfig((config: Rsbuild.EnvironmentConfig) => {
            config.source ??= {};
            config.source.entry = {
              index: './src/index.ts',
              'mini/index': './src/mini/index.ts',
            };
          });
        },
      }],
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
      plugins: [pluginLynxRuntime()],
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

export default config;
