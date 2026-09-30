import { createRequire } from 'node:module';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const require = createRequire(import.meta.url);
const defaultConfig = createConfig({
  transformPath: require.resolve(
    '../../../fixtures/legacy-main-thread-transform.cjs',
  ),
}, {
  mainThreadChunks: ['main__main-thread.js'],
}, {});

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
