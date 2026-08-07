// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

/**
 * A shim to `webpack.ProvidePlugin`. Can be used in both webpack & rspack.
 */
export class ProvidePlugin {
  constructor(
    public definitions: Record<string, string | string[]>,
  ) {}

  // Using `webpack.Compiler` to get typescript check in webpack-chain of rsbuild
  apply(compiler: Rspack.Compiler): void {
    const { ProvidePlugin } = compiler.webpack

    new ProvidePlugin(this.definitions).apply(compiler)
  }
}
