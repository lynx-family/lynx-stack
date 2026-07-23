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
  // Mirrors the rspeedy entry layout with `enableMTSRendering: false`: the
  // packed main-thread chunk only boots the runtime, and the user code is
  // compiled in the main-thread layer through the `collect` entry so the
  // loader can collect the per-module snapshot and worklet registrations.
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
