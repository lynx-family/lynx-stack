import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
