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
        // Ship the rspack transform loader verbatim (it is a CommonJS `.cjs`
        // file loaded by rspack via `require`, so it must NOT go through the
        // rslib entry pipeline that would rewrite it to ESM).
        copy: {
          patterns: [
            {
              from: './src/setupFiles/transform-loader.cjs',
              to: './setupFiles/transform-loader.cjs',
            },
          ],
        },
        externals: [
          /^@lynx-js\/react/,
          /^\.\.\/\.\.\/runtime\/lib/,
          /^preact/,
          /^vitest/,
          '@rstest/core',
          '@rsbuild/core',
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
        ],
      },
    },
    {
      format: 'esm',
      dts: {
        bundle: true,
        tsgo: true,
      },
      output: {
        filename: {
          js: 'type-entry/[name].js',
        },
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
