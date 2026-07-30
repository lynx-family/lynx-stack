import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  plugins: [
    pluginReactLynx({
      // Set `IN_PLACE=1` to build the same app on the default in-place
      // `'background only'` implementation and compare the outputs.
      experimental_backgroundOnlyAssembly: !process.env['IN_PLACE'],
    }),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  performance: {
    profile: enableBundleAnalysis,
  },
});
