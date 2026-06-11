import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.[jt]sx?/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  jsx: true,
                },
              },
            },
          },
          {
            loader: ReactWebpackPlugin.loaders.BACKGROUND,
          },
        ],
      },
    ],
  },
  plugins: [
    new ReactWebpackPlugin({
      disableCreateSelectorQueryIncompatibleWarning: true,
    }),
  ],
};
