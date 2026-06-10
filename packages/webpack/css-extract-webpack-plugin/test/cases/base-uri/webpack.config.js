import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/**
 * @type {import('webpack').Configuration}
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
            loader: CssExtractWebpackPlugin.loader,
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
  plugins: [new CssExtractWebpackPlugin({ experimentalUseImportModule: true })],
};
