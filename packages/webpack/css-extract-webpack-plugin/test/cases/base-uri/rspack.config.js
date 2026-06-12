import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/**
 * @type {import('@rspack/core').Configuration}
 */
export default {
  mode: 'production',
  devtool: false,
  entry: {
    index: './index.js',
  },
  optimization: {
    minimize: false,
  },
  output: {
    module: true,
    assetModuleFilename: 'asset/[name][ext]',
    chunkFormat: 'module',
    chunkLoading: 'import',
  },
  experiments: {
    css: false,
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
          },
          'css-loader',
        ],
      },
      {
        test: /\.ttf$/i,
        type: 'asset/resource',
        generator: {
          publicPath: '/assets/',
        },
      },
    ],
  },
  plugins: [new CssExtractRspackPlugin({ experimentalUseImportModule: true })],
};
