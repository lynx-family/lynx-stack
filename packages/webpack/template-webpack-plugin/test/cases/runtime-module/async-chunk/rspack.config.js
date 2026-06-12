import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    new LynxEncodePlugin(),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        hooks.asyncChunkName.tap('test', () => {
          return 'dynamic';
        });

        compilation.hooks.runtimeRequirementInTree.for(
          compiler.rspack.RuntimeGlobals.ensureChunkHandlers,
        ).tap('test', (_, set) => {
          set.add(RuntimeGlobals.lynxAsyncChunkIds);
        });
      });
    },
  ],
};
