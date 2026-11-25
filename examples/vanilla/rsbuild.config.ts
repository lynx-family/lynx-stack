import { defineConfig } from '@rsbuild/core';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/main/index.ts',
      lynxml: './src/counter.lynxml',
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
