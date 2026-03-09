import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        compilation.hooks.runtimeRequirementInTree.for(
          compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
        ).tap('test', (_, set) => {
          set.add(RuntimeGlobals.lynxAsyncChunkIds);
        });
      });
    },
    new LynxEncodePlugin(),
  ],
};
