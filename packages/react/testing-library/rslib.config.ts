import { createRequire } from 'node:module';

import { defineConfig } from '@rslib/core';

const require = createRequire(import.meta.url);

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
          'rstest-config': './src/rstest-config.ts',
        },
      },
      output: {
        externals: [
          /^@lynx-js\/react/,
          /^\.\.\/\.\.\/runtime\/lib/,
          /^preact/,
          /^vitest/,
          '@rstest/core',
          '@rsbuild/core',
          '@lynx-js/testing-environment',
          '@lynx-js/rspeedy',
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
          '@lynx-js/testing-environment',
        ],
      },
    },
    {
      format: 'esm',
      dts: {
        bundle: true,
        tsgo: true,
      },
      source: {
        entry: {
          'index': './src/entry.ts',
        },
      },
    },
  ],
  tools: {
    rspack(_, { appendRules }) {
      appendRules({
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
