import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

import { pluginLynxBundleAnalysisStats } from '../bundle-analysis-stats.plugin.js';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      fullscreen: true,
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
