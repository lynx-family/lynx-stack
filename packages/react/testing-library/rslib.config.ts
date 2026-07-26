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
    rspack(config, { appendRules }) {
      // Rslib prefixes chunk names with `<libIndex>~` when a config has more
      // than one `lib` entry. Vite refuses to load any path containing `~` on
      // Windows (an 8.3 short-name guard), so `dist/pure.js` importing
      // `./0~rslib-runtime.js` breaks every Windows consumer that runs it
      // through Vite. Swap the separator for `-`.
      if (typeof config.output?.chunkFilename === 'string') {
        config.output.chunkFilename = config.output.chunkFilename.replaceAll(
          '~',
          '-',
        );
      }
      const runtimeChunk = config.optimization?.runtimeChunk;
      if (
        typeof runtimeChunk === 'object' && typeof runtimeChunk.name === 'string'
      ) {
        runtimeChunk.name = runtimeChunk.name.replaceAll('~', '-');
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
