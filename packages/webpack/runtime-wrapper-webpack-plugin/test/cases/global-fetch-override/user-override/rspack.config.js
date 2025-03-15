/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { RuntimeWrapperWebpackPlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  devtool: false,
  mode: 'development',
  output: {
    chunkLoading: 'require',
    chunkFormat: 'commonjs',
    chunkFilename: '[id].rspack.bundle.cjs',
    iife: false,
  },
  plugins: [
    new RuntimeWrapperWebpackPlugin({
      test: /\.c?js$/,
    }),
  ],
};
