import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...config,
  output: {
    ...config.output,
    chunkFilename: '.rspeedy/lazy-bundle/[name].js',
  },
  optimization: {
    ...config.optimization,
    // Merge the shared module into each layer's entry chunk instead of a new
    // async chunk, so the entry chunk is referenced by the lazy bundle chunk
    // groups. See #4044.
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      cacheGroups: {
        shared: {
          test: /[\\/]shared\.js$/,
          name(_module, _chunks, cacheGroupKey) {
            return cacheGroupKey.includes('main-thread')
              ? 'main__main-thread'
              : 'main__background';
          },
          layer: /background/,
          enforce: true,
        },
        sharedMainThread: {
          test: /[\\/]shared\.js$/,
          name: 'main__main-thread',
          layer: /main-thread/,
          enforce: true,
        },
      },
    },
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
  ],
};
