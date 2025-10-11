import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong';
import { pluginPublint } from 'rsbuild-plugin-publint';

const config: RslibConfig = defineConfig({
  source: {
    entry: {
      'index': './src/index.ts',
    },
  },
  lib: [
    { format: 'esm', syntax: ['esnext'], dts: true, autoExternal: true },
  ],
  output: {
    sourceMap: true,
    target: 'node',
    distPath: {
      root: './dist',
    },
  },
  plugins: [
    pluginAreTheTypesWrong({
      enable: Boolean(process.env['CI']),
      areTheTypesWrongOptions: {
        ignoreRules: [
          'cjs-resolves-to-esm',
        ],
      },
    }),
    pluginPublint(),
  ],
});

export default config;
