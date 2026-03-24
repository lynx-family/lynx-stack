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
    distPath: {
      root: 'dist-external-bundle',
    },
    dataUriLimit: Number.POSITIVE_INFINITY,
    externalsPresets: {
      reactlynx: true,
    },
    globalObject: 'globalThis',
  },
});
