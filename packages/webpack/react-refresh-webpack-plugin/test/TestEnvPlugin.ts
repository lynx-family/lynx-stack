// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Compiler } from '@rspack/core';

export class TestEnvPlugin {
  apply(compiler: Compiler): void {
    new compiler.rspack.DefinePlugin({
      __DEV__: 'true',
      __PROFILE__: 'false',
    }).apply(compiler);

    new compiler.rspack.BannerPlugin({
      banner: `var globDynamicComponentEntry;`,
      raw: true,
      test: /\.js$/,
    }).apply(compiler);
  }
}
