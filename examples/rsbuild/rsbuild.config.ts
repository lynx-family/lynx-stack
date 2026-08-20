import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

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
    // `pluginLynx` is applied by `pluginReactLynx` when it is not already there,
    // so this is the only plugin needed to build a Lynx bundle with Rsbuild.
    pluginReactLynx(),
  ],
});
