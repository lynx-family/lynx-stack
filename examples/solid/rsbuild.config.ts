import { defineConfig } from '@rsbuild/core';

import { pluginLynx } from '@lynx-js/rsbuild-plugin';
import { pluginSolidLynx } from '@lynx-js/solid-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginLynx(),
    pluginSolidLynx(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
