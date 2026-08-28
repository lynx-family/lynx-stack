import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export default defineConfig({
  environments: {
    lynx: {},
  },
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginLynx({
      output: {
        filename: {
          bundle: '[name].[platform].bundle',
        },
      },
    }),
    pluginReactLynx(),
  ],
});
