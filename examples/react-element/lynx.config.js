import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  source: {
    define: {
      __ALOG__: 'true',
      __ALOG_ELEMENT_API__: 'true',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  environments: {
    web: {},
    lynx: {
      performance: {
        profile: enableBundleAnalysis,
      },
    },
  },
});
