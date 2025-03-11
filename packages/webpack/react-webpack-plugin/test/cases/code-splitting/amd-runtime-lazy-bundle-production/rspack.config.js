import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...config,
  output: {
    ...config.output,
    chunkFilename: '.rspeedy/async/[name].js',
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      experimental_isLazyBundle: true,
      chunks: ['main:main-thread', 'main:background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
  ],
  mode: 'production',
};
