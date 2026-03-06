import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  plugins: [
    new LynxEncodePlugin({
      inlineScripts: false,
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
    /**
     * @param {import('@rspack/core').Compiler} compiler - Rspack Compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        hooks.asyncChunkName.tap(
          'test',
          chunkName =>
            chunkName
              .replace(':main-thread', '')
              .replace(':background', ''),
        );
      });
    },
  ],
};
