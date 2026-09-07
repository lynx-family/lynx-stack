import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginLynxBundleAnalysisStats } from '../bundle-analysis-stats.plugin.js';

// Set `USE_ELEMENT_TEMPLATE=1` to build the same app through the Element
// Template render path instead of the snapshot one.
const useElementTemplate = process.env['USE_ELEMENT_TEMPLATE'] === '1';

export default defineConfig({
  plugins: [
    pluginReactLynx({
      experimental_useElementTemplate: useElementTemplate,
    }),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  source: {
    define: {
      __USE_ELEMENT_TEMPLATE__: JSON.stringify(useElementTemplate),
    },
  },
  environments: {
    web: {},
    lynx: {},
  },
});
