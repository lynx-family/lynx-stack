import { defineConfig } from '@rsbuild/core';
import './scripts/build.js';

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
      css: '[name].css',
    },
    assetPrefix: 'auto',
    overrideBrowserslist: ['Chrome >= 92', 'Safari >= 16.1'],
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
