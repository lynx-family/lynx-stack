import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      filename: '[name]/lazy.bundle',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle: true,
    }),
  ],
};
