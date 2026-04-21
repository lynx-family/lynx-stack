import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
