import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: {
      pageA: './src/pageA.tsx',
      pageB: './src/pageB.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginQRCode({
      fullscreen: true,
    }),
    pluginExternalBundle({
      externalBundleRoot: 'dist-external-bundle',
      // Pages sharing one JS context mount loaded externals on globalThis, so
      // each external bundle is evaluated only once per context.
      globalObject: 'globalThis',
      // All @lynx-js/react requests resolve to the multi-root ReactLynx
      // bundle built by react.rslib.config.ts.
      externalsPresets: {
        reactlynx: { async: false },
      },
      externals: {
        // Overrides the preset-managed asset so the locally built bundle in
        // `dist-external-bundle` is emitted instead of the prebuilt
        // @lynx-js/react-umd artifact.
        'react': {
          bundlePath: 'react.lynx.bundle',
          libraryName: ['ReactLynx', 'React'],
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        'example-shared': {
          bundlePath: 'shared.lynx.bundle',
          libraryName: ['./Shared.js'],
          background: { sectionPath: './Shared.js' },
          mainThread: { sectionPath: './Shared.js__main-thread' },
          async: false,
        },
      },
    }),
  ],
  environments: {
    lynx: {},
  },
});
