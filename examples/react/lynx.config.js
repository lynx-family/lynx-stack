import { codecovWebpackPlugin } from '@codecov/webpack-plugin';

import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const enableBundleAnalysis = !!process.env['CI'];

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  tools: {
    rspack: {
      plugins: [
        codecovWebpackPlugin({
          enableBundleAnalysis,
          bundleName: '@lynx-js/example-react',
          uploadToken: process.env['CODECOV_TOKEN'] ?? '',
          telemetry: false,
          uploadOverrides: {
            sha: process.env['GITHUB_SHA'] ?? '',
          },
        }),
      ],
    },
  },
});
