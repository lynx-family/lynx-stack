import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

export default defineConfig({
  // performance: {
  //   chunkSplit: {
  //     strategy: 'split-by-experience',
  //     override: {
  //       // See: https://github.com/web-infra-dev/rspack/issues/9812
  //       filename: '[name].[contenthash:8].js',
  //     },
  //   },
  // },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  performance: {
    profile: enableBundleAnalysis,
  },
});
