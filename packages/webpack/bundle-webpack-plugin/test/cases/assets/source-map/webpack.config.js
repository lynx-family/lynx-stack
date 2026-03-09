import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
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
