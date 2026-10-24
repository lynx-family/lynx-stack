import { defineConfig } from '@rsbuild/core';

import { pluginLynx } from '@lynx-js/rsbuild-plugin';
import { pluginVanillaLynx } from '@lynx-js/vanilla-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/main-thread.ts',
    },
  },
  plugins: [pluginLynx(), pluginVanillaLynx()],
  environments: {
    web: {},
    lynx: {},
  },
});
