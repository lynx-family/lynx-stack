import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    { format: 'esm', syntax: ['esnext'], dts: true },
  ],
  output: {
    filename: {
      // See: https://github.com/web-infra-dev/rslib/issues/1167
      wasm: '[contenthash:8].module.wasm',
    },
    sourceMap: true,
  },
  tools: {
    rspack: {
      output: {
        wasmLoading: 'async-node',
      },
    },
  },
});

export default config;
