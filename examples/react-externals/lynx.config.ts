import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginLynxBundleAnalysisStats } from '../bundle-analysis-stats.plugin.js';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        './App.js': 'comp-lib.lynx.bundle',
      },
      globalObject: 'globalThis',
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  environments: {
    web: {},
    lynx: {},
  },
  output: {
    filenameHash: 'contenthash:8',
  },
});
