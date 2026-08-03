import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
        typescriptPath: fileURLToPath(
          import.meta.resolve('@typescript/native-preview'),
        ),
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
    rspack(config, { appendRules }) {
      // Rslib separates generated chunk names and their lib index with `~`.
      // Vite refuses to load any path containing `~` on Windows (an 8.3
      // short-name guard), so replace the separator in initial chunk names.
      const filename = config.output?.filename;
      if (typeof filename === 'function') {
        config.output.filename = (pathData, assetInfo) => filename(pathData, assetInfo).replaceAll('~', '-');
      }
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
