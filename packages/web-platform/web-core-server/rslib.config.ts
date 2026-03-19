import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';
import { pluginAreTheTypesWrong } from 'rsbuild-plugin-arethetypeswrong';
import { pluginPublint } from 'rsbuild-plugin-publint';

const config: RslibConfig = defineConfig({
  lib: [
    { format: 'esm', syntax: ['esnext'], dts: { tsgo: true } },
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
      experiments: {
        futureDefaults: true,
      },
    },
  },
});

export default config;
