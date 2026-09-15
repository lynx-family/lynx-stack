import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  environments: {
    lynx: {},
  },
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode(),
  ],
});
