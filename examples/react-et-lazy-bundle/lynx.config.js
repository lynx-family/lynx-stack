import os from 'node:os';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

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

// Lazy bundles are fetched by absolute URL: with the default `/` public path a
// device gets a relative schema, never fetches the lazy bundle and never
// resolves the `import()`.
const port = Number(process.env['LYNX_LAZY_BUNDLE_PORT'] ?? '54174');
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
      experimental_useElementTemplate: true,
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
    lynx: {},
  },
  performance: {
    profile: enableBundleAnalysis,
  },
});
