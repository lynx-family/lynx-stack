import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  splitChunks: {
    cacheGroups: {
      shared: {
        test: /[\\/]src[\\/]shared\.ts$/,
        name: 'shared',
        minSize: 0,
      },
    },
  },
  environments: {
    lynx: {},
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
});
