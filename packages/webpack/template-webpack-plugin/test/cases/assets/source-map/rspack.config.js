import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  target: 'node',
  plugins: [
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
    new LynxEncodePlugin(),
  ],
};
