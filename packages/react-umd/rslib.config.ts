import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const target = process.env['EXTERNAL_BUNDLE_TARGET'] === 'web' ? 'web' : 'tasm';

export default defineExternalBundleRslibConfig({
  id: process.env.NODE_ENV === 'development' ? 'react-dev' : 'react-prod',
  source: {
    entry: {
      'ReactLynx': './src/index.ts',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  output: {
    cleanDistPath: false,
    distPath: './dist',
  },
  performance: {
    buildCache: false,
  },
}, {
  target,
});
