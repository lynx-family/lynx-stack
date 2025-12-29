import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong';
import { pluginPublint } from 'rsbuild-plugin-publint';

const config: RslibConfig = defineConfig({
  source: {
    entry: {
      'index': './src/node/index.ts',
    },
  },
  lib: [
    { format: 'esm', syntax: ['esnext', 'node 20'], dts: { tsgo: true } },
  ],
  output: {
    filename: {
      // See: https://github.com/web-infra-dev/rslib/issues/1167
      wasm: '[contenthash:8].module.wasm',
    },
    sourceMap: true,
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
  tools: {
    rspack: {
      output: {
        wasmLoading: 'async-node',
      },
    },
  },
});

export default config;
