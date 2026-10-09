import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const layer = process.env['SPLIT_LAYER'];
const noSplit = process.env['NO_SPLIT'] === '1';
const distRoot = process.env['DIST_ROOT'] ?? 'dist';
const assetPrefix = process.env['REPRO_ASSET_PREFIX'];

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  output: {
    distPath: {
      root: distRoot,
    },
    ...(assetPrefix ? { assetPrefix } : {}),
  },
  plugins: [pluginReactLynx()],
  ...(noSplit
    ? {}
    : {
      splitChunks: {
        preset: /** @type {const} */ ('none'),
        cacheGroups: {
          shared: {
            test: /[\\/]src[\\/]shared\.ts$/,
            name: 'shared',
            minChunks: 2,
            minSize: 0,
            priority: 10,
            ...(layer ? { layer: new RegExp(layer) } : {}),
          },
        },
      },
    }),
  environments: {
    lynx: {},
  },
});
