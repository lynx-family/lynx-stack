import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '../../../create-react-config.js';
import {
  LynxTemplatePlugin,
  LynxEncodePlugin,
} from '@lynx-js/template-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfig = createConfig({}, {
  experimental_isLazyBundle: true,
  mainThreadChunks: [
    'main__main-thread.js',
    './lazy.jsx-react__main-thread.js',
  ],
}, {});

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...defaultConfig,
  optimization: {
    ...defaultConfig.optimization,
    minimize: true,
  },
  plugins: [
    ...defaultConfig.plugins,
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.json',
      intermediate: '.rspeedy',
      experimental_isLazyBundle: true,
    }),
  ],
};
