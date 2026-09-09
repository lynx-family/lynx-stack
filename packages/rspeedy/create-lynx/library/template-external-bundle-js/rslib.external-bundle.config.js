import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

// Packs the library into `dist-external-bundle/<id>.lynx.bundle`, a Lynx
// bundle that a host app loads at runtime with
// `@lynx-js/external-bundle-rsbuild-plugin` instead of compiling the library
// into every page.
//
// For a bundle without ReactLynx (utilities such as lodash), drop
// `pluginReactLynx()` and `externalsPresets`, use `pluginLynx()` from
// `@lynx-js/rsbuild-plugin`, and give the entry a layer:
// `{ import: './src/index.js', layer: LAYERS.BACKGROUND }`.
export default defineExternalBundleRslibConfig({
  id: 'library',
  source: {
    entry: {
      // The key is the module name the host imports.
      library: './src/index.js',
    },
  },
  plugins: [pluginReactLynx()],
  output: {
    // ReactLynx itself comes from the host's `react.lynx.bundle`.
    externalsPresets: {
      reactlynx: true,
    },
    globalObject: 'globalThis',
  },
})
