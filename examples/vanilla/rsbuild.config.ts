import { defineConfig } from '@rsbuild/core';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.ts',
    },
  },
  plugins: [
    pluginLynx(),
    pluginLynxConfig({ enableEventHandleRefactor: true }),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
