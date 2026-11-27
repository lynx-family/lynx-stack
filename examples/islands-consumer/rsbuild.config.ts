import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const host = process.env['LYNX_HOST'] ?? '127.0.0.1';

export default defineConfig({
  source: {
    entry: { main: './src/index.tsx' },
    define: {
      __ISLAND_ENTRY__: JSON.stringify(
        process.env['ISLAND_ENTRY']
          ?? `http://${host}:3001/greeting.lynx.bundle`,
      ),
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({ schema: url => `${url}?fullscreen=true` }),
  ],
  output: { assetPrefix: `http://${host}:3000/` },
  dev: { assetPrefix: `http://${host}:3000/` },
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
});
