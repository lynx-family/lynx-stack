import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'none',
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
