import path from 'node:path';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: path.join(import.meta.dirname, 'nested'),
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        compilation.hooks.runtimeRequirementInTree.for(
          compiler.rspack.RuntimeGlobals.ensureChunkHandlers,
        ).tap('test', (_, set) => {
          set.add(RuntimeGlobals.lynxAsyncChunkIds);
        });

        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        hooks.asyncChunkName.tap(
          'test',
          chunkName => chunkName.replace(':background', ''),
        );
      });
    },
    new LynxEncodePlugin(),
  ],
};
