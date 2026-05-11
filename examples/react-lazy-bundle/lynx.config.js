import os from 'node:os';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];
const enableFetchBundle = !!process.env['LAZY_BUNDLE_FETCHBUNDLE'];

function detectLanHost() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  throw new Error('No external IPv4 interface found for lazy bundle host.');
}

const port = Number(process.env['LYNX_LAZY_BUNDLE_PORT'] ?? '54173');
const assetPrefix = `http://${detectLanHost()}:${port}/`;

export default defineConfig({
  output: {
    assetPrefix,
  },
  server: {
    port,
    strictPort: true,
  },
  plugins: [
    pluginReactLynx({
      ...(enableFetchBundle ? { engineVersion: '3.8' } : {}),
    }),
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
