import { createConfig } from '../../../create-react-config.js';
import { rspack } from '@rspack/core';

const defaultConfig = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...defaultConfig,
  optimization: {
    ...defaultConfig.optimization,
    concatenateModules: true,
    innerGraph: true,
    providedExports: true,
    sideEffects: true,
    usedExports: true,
    minimize: true,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            defaults: true,
            passes: 2,
            side_effects: true,
            toplevel: true,
            unused: true,
          },
          mangle: {
            toplevel: true,
          },
        },
      }),
    ],
  },
};
