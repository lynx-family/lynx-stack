import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  devtool: false,
  mode: 'development',
  experiments: { layers: true },
  entry: {
    main: { import: './index.js', layer: 'react:background' },
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      intermediate: '.rspeedy/main',
    }),
  ],
};
