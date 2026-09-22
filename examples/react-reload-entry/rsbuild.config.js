import { defineConfig } from '@rsbuild/core';

import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const reloadEntryReeval = process.env['RELOAD_ENTRY_REEVAL'] === '1';
const distRoot = reloadEntryReeval ? 'dist/reeval' : 'dist/baseline';
const host = process.env['LYNX_HOST'] ?? '127.0.0.1:8412';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  output: {
    assetPrefix: `http://${host}/${distRoot}/`,
    distPath: {
      root: distRoot,
    },
  },
  plugins: [
    pluginReactLynx({
      experimental_reloadEntryReeval: reloadEntryReeval,
    }),
    pluginExternalBundle({
      externalsPresets: { reactlynx: true },
      globalObject: 'globalThis',
    }),
    pluginQRCode({ fullscreen: true }),
  ],
  environments: {
    lynx: {
      performance: {
        profile: true,
      },
    },
  },
});
