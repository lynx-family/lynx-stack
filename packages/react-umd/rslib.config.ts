import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const target = process.env['EXTERNAL_BUNDLE_TARGET'] === 'web' ? 'web' : 'tasm';
const isDev = process.env.NODE_ENV === 'development';

export default defineExternalBundleRslibConfig({
  id: isDev ? 'react-dev' : 'react-prod',
  source: {
    entry: {
      'ReactLynx': isDev ? './src/index.dev.ts' : './src/index.ts',
    },
  },
  plugins: [
    // The shared external bundle serves several cards in one JS context, so
    // it is built with multi-card roots on.
    pluginReactLynx({ experimental_multiCardRoots: true }),
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
