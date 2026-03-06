import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  target: 'node',
  output: {
    chunkFilename: 'async/[name].js',
  },
  plugins: [
    new LynxTemplatePlugin({ filename: 'main.tasm' }),
    new LynxEncodePlugin(),
  ],
};
