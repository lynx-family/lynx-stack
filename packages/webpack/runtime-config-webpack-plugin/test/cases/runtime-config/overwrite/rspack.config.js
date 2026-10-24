import { RuntimeConfigWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('@rspack/core').Configuration} */
export default {
  plugins: [
    new RuntimeConfigWebpackPlugin({
      sharedConfig: {
        source: 'current',
      },
    }),
  ],
};
