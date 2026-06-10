import { LAYERS } from '@lynx-js/react-webpack-plugin';
import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig({}, {}, { jsc: { target: 'es2019' } });

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  module: {
    rules: [
      ...defaultConfig.module.rules,
      {
        issuerLayer: LAYERS.BACKGROUND,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            target: 'es2015',
          },
        },
      },
    ],
  },
};
