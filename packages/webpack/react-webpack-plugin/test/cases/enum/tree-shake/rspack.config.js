import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  optimization: {
    ...defaultConfig.optimization,
    sideEffects: true,
    usedExports: true,
    minimize: true,
  },
};
