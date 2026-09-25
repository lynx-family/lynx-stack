import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.jsx',
    },
  },
  plugins: [pluginQRCode({ fullscreen: true }), pluginReactLynx()],
});
