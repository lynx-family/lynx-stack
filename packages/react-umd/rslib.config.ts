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
