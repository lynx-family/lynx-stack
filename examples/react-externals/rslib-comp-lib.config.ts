import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineExternalBundleRslibConfig({
  id: 'comp-lib',
  source: {
    entry: {
      'CompLib': './external-bundle/CompLib.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  output: {
    cleanDistPath: false,
    dataUriLimit: Number.POSITIVE_INFINITY,
    externals: {
      '@lynx-js/react': ['ReactLynx', 'React'],
      '@lynx-js/react/internal': ['ReactLynx', 'ReactInternal'],
      '@lynx-js/react/jsx-dev-runtime': ['ReactLynx', 'ReactJSXDevRuntime'],
      '@lynx-js/react/jsx-runtime': ['ReactLynx', 'ReactJSXRuntime'],
      '@lynx-js/react/lepus/jsx-dev-runtime': [
        'ReactLynx',
        'ReactJSXLepusDevRuntime',
      ],
      '@lynx-js/react/lepus/jsx-runtime': ['ReactLynx', 'ReactJSXLepusRuntime'],
      '@lynx-js/react/experimental/lazy/import': [
        'ReactLynx',
        'ReactLazyImport',
      ],
      '@lynx-js/react/legacy-react-runtime': [
        'ReactLynx',
        'ReactLegacyRuntime',
      ],
      '@lynx-js/react/runtime-components': ['ReactLynx', 'ReactComponents'],
      '@lynx-js/react/worklet-runtime/bindings': [
        'ReactLynx',
        'ReactWorkletRuntime',
      ],
      '@lynx-js/react/debug': ['ReactLynx', 'ReactDebug'],
      'preact': ['ReactLynx', 'Preact'],
    },
    minify: false,
  },
});
