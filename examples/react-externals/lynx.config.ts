import os from 'node:os';

import {
  builtInExternalsPresetDefinitions,
  pluginExternalBundle,
} from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginLynxBundleAnalysisStats } from '../bundle-analysis-stats.plugin.js';

// REACTLYNX_ASYNC=true loads the ReactLynx external bundle asynchronously
// (mounted as a Promise) instead of as a synchronous global. Async outputs are
// isolated in `dist-react-async` / `dist-external-bundle-react-async` so the
// default (sync) build is untouched.
const isAsync = process.env['REACTLYNX_ASYNC'] === 'true';

// The `react.lynx.bundle` / `comp-lib.lynx.bundle` externals are loaded at
// runtime via `lynx.loadScript`, which needs an absolute URL — a root-relative
// `/react.lynx.bundle` fails on device/`preview` ("File not found"). Point
// `assetPrefix` at the LAN host and a fixed port so the baked URLs are
// reachable; `strictPort` keeps that port stable across dev/preview.
function detectLanHost() {
  if (process.env['LYNX_HOST']) return process.env['LYNX_HOST'];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
const port = Number(process.env['PORT'] ?? 3000);
const assetPrefix = `http://${detectLanHost()}:${port}/`;

const reactlynxPreset = builtInExternalsPresetDefinitions['reactlynx']!;

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginExternalBundle({
      ...(isAsync && {
        externalBundleRoot: 'dist-external-bundle-react-async',
        externalsPresetDefinitions: {
          'reactlynx-async': {
            resolveExternals: (value, context) =>
              Object.fromEntries(
                Object.entries(
                  reactlynxPreset.resolveExternals!(value, context),
                ).map(([request, external]) => [
                  request,
                  { ...external, async: true },
                ]),
              ),
            resolveManagedAssets: (value, context) =>
              reactlynxPreset.resolveManagedAssets!(value, context),
          },
        },
      }),
      externalsPresets: isAsync
        ? { 'reactlynx-async': true }
        : { reactlynx: true },
      externals: {
        './App.js': 'comp-lib.lynx.bundle',
      },
      globalObject: 'globalThis',
    }),
    pluginLynxBundleAnalysisStats(),
  ],
  environments: {
    ...(isAsync ? {} : { web: {} }),
    lynx: {},
  },
  output: {
    filenameHash: 'contenthash:8',
    assetPrefix,
    ...(isAsync && { distPath: { root: 'dist-react-async' } }),
  },
  dev: {
    assetPrefix,
  },
  server: {
    port,
    strictPort: true,
  },
});
