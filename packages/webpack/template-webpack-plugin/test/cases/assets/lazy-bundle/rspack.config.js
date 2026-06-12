import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
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
