import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...config,
  output: {
    ...config.output,
    chunkFilename: '[name].[id].[contenthash:8].js',
  },
  optimization: {
    ...config.optimization,
    chunkIds: 'deterministic',
  },
};
