import { CssExtractRspackPlugin } from '@rspack/core';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  entry: {
    main: './code-splitting/initial-css-order/entry-main.js',
  },
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
        common: {
          test: /common\.js$/,
          name: 'common',
          enforce: true,
          priority: 3,
        },
        featureA: {
          test: /feature-a\.js$/,
          name: 'feature-a',
          enforce: true,
          priority: 2,
        },
        featureB: {
          test: /feature-b\.js$/,
          name: 'feature-b',
          enforce: true,
          priority: 1,
        },
      },
    },
  },
  plugins: [
    new CssExtractRspackPlugin({}),
    new LynxEncodePlugin({
      inlineScripts: /(main|common|feature-a|feature-b)\.js$/,
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
  ],
};
