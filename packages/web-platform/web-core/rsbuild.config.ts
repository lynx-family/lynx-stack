import { defineConfig } from '@rsbuild/core';
import { pluginSourceBuild } from '@rsbuild/plugin-source-build';
import { pluginEslint } from '@rsbuild/plugin-eslint';

export default defineConfig({
  source: {
    entry: {
      client: './ts/client/index.ts',
    },
  },
  output: {
    sourceMap: {
      js: 'source-map',
      css: true,
    },
    distPath: {
      root: './dist/client_prod',
    },
    filename: {
      js: '[name].js',
      css: '[name].css',
    },
    assetPrefix: 'auto',
    module: true,
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  tools: {
    htmlPlugin: false,
  },
  plugins: [
    pluginSourceBuild({
      sourceField: '@lynx-js/source-field',
    }),
    pluginEslint({
      eslintPluginOptions: {
        configType: 'flat',
      },
    }),
  ],
});
