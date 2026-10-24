import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  devtool: false,
  mode: 'development',
  experiments: { layers: true },
  entry: {
    main: {
      import: './index.js',
      layer: 'react:background',
      filename: '.rspeedy/main/background.[contenthash:8].js',
    },
  },
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
      // A user regex that matches the entry's background but none of the
      // lazy bundle's background chunks. They must still be inlined.
      inlineScripts: /[\\/]main[\\/]background\.\w+\.js$/,
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
