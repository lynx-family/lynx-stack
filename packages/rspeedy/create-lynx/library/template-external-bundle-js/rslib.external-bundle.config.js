import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default defineExternalBundleRslibConfig({
  id: 'library',
  source: {
    entry: {
      library: './src/index.js',
    },
  },
  plugins: [pluginReactLynx()],
  output: {
    externalsPresets: {
      reactlynx: true,
    },
  },
})
