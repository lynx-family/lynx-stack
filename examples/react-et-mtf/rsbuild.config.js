import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginLynx({
      performance: {
        profile: enableBundleAnalysis,
      },
    }),
    pluginReactLynx({
      experimental_useElementTemplate: true,
    }),
    pluginQRCode(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});
