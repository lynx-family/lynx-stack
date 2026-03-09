import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  output: {
    filename: (...args) => {
      if (args[0].chunk.name === 'main') {
        return 'rspack.bundle.js';
      }
      return '[name].js';
    },
  },
  optimization: {
    splitChunks: {
      chunks: function(chunk) {
        return !chunk.name?.includes('__main-thread');
      },
      cacheGroups: {
        foo: {
          test: /foo\.js/,
          priority: 0,
          name: 'foo',
          enforce: true,
        },
        bar: {
          test: /bar\.js/,
          priority: 0,
          name: 'bar',
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new LynxEncodePlugin({
      inlineScripts: /(foo|main)\.js$/,
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
  ],
};
