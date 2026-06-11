import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  output: {
    publicPath: 'https://example.com/',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
  ],
};
