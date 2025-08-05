import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';

const config: RslibConfig = defineConfig({
  lib: [
    { format: 'esm', syntax: ['esnext'], dts: true },
  ],
  output: {
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
