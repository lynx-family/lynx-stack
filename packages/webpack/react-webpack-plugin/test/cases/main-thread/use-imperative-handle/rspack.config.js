import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...defaultConfig,
  resolve: {
    ...defaultConfig.resolve,
    alias: {
      'react': '@lynx-js/react',
      '@lynx-js/react-runtime': '@lynx-js/react',
    },
  },
};
