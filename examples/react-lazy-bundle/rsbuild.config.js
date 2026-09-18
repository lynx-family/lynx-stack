import os from 'node:os';

import { defineConfig } from '@rsbuild/core';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

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
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  output: {
    assetPrefix,
    // Give the FetchBundle variant its own output dir so `pnpm build`'s two
    // sequential builds don't clobber each other (Rspeedy cleans `dist/`
    // before each build).
    ...(enableFetchBundle ? { distPath: { root: 'dist-fetchbundle' } } : {}),
  },
  server: {
    port,
    strictPort: true,
  },
  plugins: [
    pluginLynx({
      performance: {
        profile: enableBundleAnalysis,
      },
    }),
    pluginReactLynx({
      ...(enableFetchBundle ? { engineVersion: '3.9' } : {}),
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
});
