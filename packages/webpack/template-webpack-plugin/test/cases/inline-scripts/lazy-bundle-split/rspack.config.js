import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  optimization: {
    // Enable bundle splitting so the lazy bundle's background is split
    // into more than one chunk.
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      cacheGroups: {
        shared: {
          test: /shared\.js/,
          name: 'shared',
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new LynxEncodePlugin({
      // The production config used a regex intended to match `background.js`,
      // but it does not match the real chunk name (e.g. `component__background.js`).
      // The lazy bundle's background must still be inlined.
      inlineScripts: /[\\/]background\.\w+\.js$/,
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
