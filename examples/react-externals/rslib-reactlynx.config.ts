import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineExternalBundleRslibConfig({
  id: 'react',
  source: {
    entry: {
      'ReactLynx': './external-bundle/ReactLynx.ts',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  output: {
    cleanDistPath: false,
    minify: false,
  },
});
