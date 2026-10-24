import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  target: 'node',
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        shared: {
          test: /dynamic[.]js$/,
          name: 'dynamic',
          minSize: 0,
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        compilation.hooks.runtimeRequirementInTree.for(
          compiler.rspack.RuntimeGlobals.ensureChunkHandlers,
        ).tap('test', (_, set) => {
          set.add(RuntimeGlobals.lynxAsyncChunkIds);
        });
      });
    },
    new LynxEncodePlugin(),
  ],
};
