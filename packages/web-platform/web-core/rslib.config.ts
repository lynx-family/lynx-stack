import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'esnext',
      dts: false,
      source: {
        entry: {
          index: './ts/server/index.ts',
        },
      },
      output: {
        externals: [
          /\.wasm$/,
          /binary\/server\/.*\.js$/,
        ],
        distPath: {
          root: './dist/server_prod',
        },
      },
    },
    {
      // `./encode` is bundled rather than published as-is so that the
      // `--target bundler` wasm glue is resolved here, at web-core build time,
      // instead of by the consumer's Node runtime. Importing `encode_bg.wasm`
      // as an ES module works only on Node >= 22 and emits
      // `ExperimentalWarning: Importing WebAssembly module instances` on every
      // build; letting rslib emit the wasm as an asset avoids both.
      // Note: `output.externals` is intentionally NOT inherited here -- the
      // `/\.wasm$/` external used by the server entry would keep the glue's
      // wasm import unresolved.
      format: 'esm',
      syntax: 'esnext',
      dts: false,
      source: {
        entry: {
          index: './ts/encode/index.ts',
        },
      },
      output: {
        distPath: {
          root: './dist/encode_prod',
        },
      },
    },
  ],
  output: {
    target: 'node',
  },
});
