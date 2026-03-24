import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];

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
      externalBundleRoot: 'dist-external-bundle',
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        './App.js': {
          libraryName: 'CompLib',
          bundlePath: 'comp-lib.lynx.bundle',
          background: { sectionPath: 'CompLib' },
          mainThread: { sectionPath: 'CompLib__main-thread' },
          async: true,
        },
      },
      globalObject: 'globalThis',
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
  output: {
    filenameHash: 'contenthash:8',
  },
});
