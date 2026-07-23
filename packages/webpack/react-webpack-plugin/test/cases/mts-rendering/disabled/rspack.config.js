import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { LAYERS } from '@lynx-js/react-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig({
  enableMTSRendering: false,
}, {
  mainThreadChunks: ['main__main-thread.js'],
  enableMTSRendering: false,
  mainThreadCollectChunks: ['main__main-thread-collect.js'],
});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  entry: {
    'main__main-thread': {
      layer: LAYERS.MAIN_THREAD,
      import: '@lynx-js/react/internal',
      filename: 'main__main-thread.js',
    },
    'main__main-thread-collect': {
      layer: LAYERS.MAIN_THREAD,
      import: './index.jsx',
      filename: 'main__main-thread-collect.js',
    },
    'main__background': {
      layer: LAYERS.BACKGROUND,
      import: './index.jsx',
      filename: 'main__background.js',
    },
  },
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
