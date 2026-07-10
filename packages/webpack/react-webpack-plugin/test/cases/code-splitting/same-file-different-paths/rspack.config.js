import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      '@': import.meta.dirname,
    },
  },
  output: {
    ...config.output,
    chunkFilename: '.rspeedy/async/[name].js',
  },
  plugins: [
    ...config.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
  ],
};
