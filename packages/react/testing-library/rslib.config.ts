import { createRequire } from 'node:module';

import { defineConfig } from '@rslib/core';

const require = createRequire(import.meta.url);

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      bundle: true,
      source: {
        entry: {
          'pure': './src/pure.jsx',
          'env/vitest': './src/env/vitest.ts',
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
          'index': './src/index.jsx',
          'vitest.config': './src/vitest.config.js',
          'vitest-global-setup': './src/vitest-global-setup.js',
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
