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
    pluginReactLynx({
      experimental_useElementTemplate: true,
    }),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
