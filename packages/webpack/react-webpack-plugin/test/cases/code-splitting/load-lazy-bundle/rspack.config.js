import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...config,
  optimization: {
    ...config.optimization,
    usedExports: true,
    innerGraph: true,
    sideEffects: true,
    minimize: true,
  },
  mode: 'production',
};
