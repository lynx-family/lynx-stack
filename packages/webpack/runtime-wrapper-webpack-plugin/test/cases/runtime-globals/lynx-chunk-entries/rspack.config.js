import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'development',
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
