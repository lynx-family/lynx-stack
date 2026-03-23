import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig(undefined, {
  mainThreadChunks: [
    'main__main-thread.js',
    './lazy.jsx-react__main-thread.js',
  ],
  experimental_isLazyBundle: true,
});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...config,
  devtool: 'source-map',
  optimization: {
    ...config.optimization,
    minimize: true,
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle: true,
    }),
  ],
};
