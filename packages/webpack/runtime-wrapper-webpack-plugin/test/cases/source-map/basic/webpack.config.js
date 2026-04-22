/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { RuntimeWrapperWebpackPlugin } from '../../../../lib/index.js';

/** @type {import('webpack').Configuration} */
export default {
  devtool: 'source-map',
  target: 'node',
  externals: ['source-map'],
  externalsType: 'commonjs',
  plugins: [
    new RuntimeWrapperWebpackPlugin(),
  ],
};
