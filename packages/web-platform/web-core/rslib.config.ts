import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'esnext',
      dts: false,
    },
  ],
  source: {
    entry: {
      index: './ts/server/index.ts',
    },
  },
  output: {
    target: 'node',
    externals: [
      /\.wasm$/,
      /binary\/server\/.*\.js$/,
    ],
    distPath: {
      root: './dist/server_prod',
    },
  },
});
