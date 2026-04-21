import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  output: {
    publicPath: 'https://example.com/',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      filename: 'main.tasm',
      intermediate: '',
    }),
  ],
};
