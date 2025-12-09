import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      client: './ts/client/index.ts',
    },
  },
  output: {
    distPath: {
      root: './dist/client_prod',
    },
    filename: {
      js: '[name].js',
    },
    assetPrefix: 'auto',
    minify: true,
  },
  tools: {
    htmlPlugin: false,
    rspack: {
      experiments: {
        futureDefaults: true,
      },
    },
  },
});
