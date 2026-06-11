import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      intermediate: '.rspeedy/main',
    }),
  ],
};
