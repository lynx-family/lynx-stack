import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { LAYERS, pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];
const EXTERNAL_BUNDLE_PREFIX = process.env['EXTERNAL_BUNDLE_PREFIX'] || '';

export default defineConfig({
  tools: {
    rspack: {
      plugins: [
        new ExternalsLoadingPlugin({
          mainThreadLayer: LAYERS.MAIN_THREAD,
          backgroundLayer: LAYERS.BACKGROUND,
          externals: {
            '@lynx-js/react': {
              libraryName: ['ReactLynx', 'React'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/internal': {
              libraryName: ['ReactLynx', 'ReactInternal'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/experimental/lazy/import': {
              libraryName: ['ReactLynx', 'ReactLazyImport'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/legacy-react-runtime': {
              libraryName: ['ReactLynx', 'ReactLegacyRuntime'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/runtime-components': {
              libraryName: ['ReactLynx', 'ReactComponents'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/worklet-runtime/bindings': {
              libraryName: ['ReactLynx', 'ReactWorkletRuntime'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            '@lynx-js/react/debug': {
              libraryName: ['ReactLynx', 'ReactDebug'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            preact: {
              libraryName: ['ReactLynx', 'Preact'],
              url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
              background: { sectionPath: 'ReactLynx' },
              mainThread: { sectionPath: 'ReactLynx__main-thread' },
              async: false,
            },
            './App.js': {
              libraryName: 'CompLib',
              url: `${EXTERNAL_BUNDLE_PREFIX}/comp-lib.lynx.bundle`,
              background: { sectionPath: 'CompLib' },
              mainThread: { sectionPath: 'CompLib__main-thread' },
              async: false,
            },
          },
        }),
      ],
    },
  },
  plugins: [
    pluginReactLynx(),
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
  output: {
    filenameHash: 'contenthash:8',
    cleanDistPath: false,
  },
});
