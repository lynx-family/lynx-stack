import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig({
  enableMTSRendering: false,
}, {
  mainThreadChunks: ['main__main-thread.js'],
  enableMTSRendering: false,
});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  plugins: [
    ...defaultConfig.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.json',
      intermediate: '.rspeedy',
    }),
  ],
};
