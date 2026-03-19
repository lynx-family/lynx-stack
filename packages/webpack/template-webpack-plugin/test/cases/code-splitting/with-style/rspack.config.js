import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';
import { CssExtractRspackPlugin } from '@rspack/core';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          CssExtractRspackPlugin.loader,
          'css-loader',
        ],
      },
    ],
  },
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
      },
    },
  },
  plugins: [
    new CssExtractRspackPlugin({}),
    new LynxEncodePlugin({
      inlineScripts: /(foo|main)\.js$/,
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
  ],
};
