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
    externalsPresets: {
      reactlynx: true,
    },
    globalObject: 'globalThis',
  },
});
