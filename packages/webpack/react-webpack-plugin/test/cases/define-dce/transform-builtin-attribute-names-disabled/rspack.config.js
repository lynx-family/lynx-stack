// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rspack } from '@rspack/core';

import { createConfig } from '../../../create-react-config.js';

const config = createConfig();

/** @type {import('@rspack/core').Configuration} */
export default {
  context: import.meta.dirname,
  ...config,
  mode: 'production',
  optimization: {
    ...config.optimization,
    minimize: true,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            defaults: true,
            inline: 0,
            passes: 2,
            reduce_funcs: false,
          },
          mangle: false,
        },
      }),
    ],
  },
};
