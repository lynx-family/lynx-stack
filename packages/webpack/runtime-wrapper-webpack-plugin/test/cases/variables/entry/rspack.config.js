import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
