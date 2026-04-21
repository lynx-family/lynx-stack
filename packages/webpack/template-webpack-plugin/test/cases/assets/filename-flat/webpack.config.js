import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'development',
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      filename: '[name].template.js',
      intermediate: '.rspeedy/main',
    }),
  ],
};
