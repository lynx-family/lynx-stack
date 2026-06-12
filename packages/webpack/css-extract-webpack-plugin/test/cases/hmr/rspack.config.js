import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: './index.css',
  mode: 'development',
  devtool: false,
  output: {
    pathinfo: false,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: CssExtractRspackPlugin.loader,
          },
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    function(compiler) {
      new compiler.webpack.HotModuleReplacementPlugin().apply(compiler);
    },
    new CssExtractRspackPlugin({
      filename: '[name].css',
    }),
  ],
};
