import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginQRCode({ fullscreen: true }),
    pluginReactLynx(),
    pluginTypeCheck(),
  ],
});
