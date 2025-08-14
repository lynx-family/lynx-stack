import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      bundle: true,
      source: {
        entry: {
          'pure': './src/pure.jsx',
          'env/index': './src/env/index.ts',
          'plugins/index': './src/plugins/index.ts',
        },
      },
      output: {
        externals: [
          /^@lynx-js\/react/,
          /^\.\.\/\.\.\/runtime\/lib/,
          /^preact/,
          /^vitest/,
        ],
      },
    },
    {
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      bundle: false,
      source: {
        entry: {
          'index': [
            './src/index.jsx',
            './src/vitest.config.ts',
            './src/env/vitest.ts',
            './src/env/rstest.ts',
            './src/setupFiles/**/*.js',
          ],
        },
      },
      output: {
        externals: [
          /@lynx-js\/react/,
          /\.\.\/\.\.\/runtime\/lib/,
        ],
      },
    },
    {
      format: 'esm',
      dts: {
        bundle: true,
      },
      source: {
        entry: {
          'index': './src/entry.ts',
        },
      },
    },
  ],
  tools: {
    rspack(config) {
      config.module!.rules!.push({
        test: /\.jsx$/,
        use: [
          {
            loader: require.resolve('./loaders/jsx-loader'),
          },
        ],
      });
    },
  },
});
