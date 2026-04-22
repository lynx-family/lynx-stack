import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  output: {
    publicPath: 'auto',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
  ],
};
