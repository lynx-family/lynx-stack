import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
