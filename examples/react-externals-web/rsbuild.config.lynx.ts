import { defineConfig } from '@rsbuild/core';

import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: {
          async: true,
        },
      },
      externals: {
        './App.js': 'comp-lib.web.bundle',
      },
      globalObject: 'globalThis',
    }),
  ],
  environments: {
    web: {},
  },
});
