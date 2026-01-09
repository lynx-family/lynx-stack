// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BannerPlugin, Compiler } from 'webpack'

/**
 * The options of {@link MainThreadRuntimeWrapperWebpackPlugin}.
 *
 * @public
 */
export interface MainThreadRuntimeWrapperWebpackPluginOptions {
  /**
   * Include all modules that pass test assertion.
   *
   * @defaultValue `/\.js$/`
   *
   * @public
   */
  test: BannerPlugin['options']['test']
}
/**
 * The main-thread runtime wrapper for external bundle.
 *
 * @public
 */
export class MainThreadRuntimeWrapperWebpackPlugin {
  constructor(
    private options: Partial<MainThreadRuntimeWrapperWebpackPluginOptions> = {},
  ) {}

  apply(compiler: Compiler): void {
    const { BannerPlugin } = compiler.webpack
    new BannerPlugin({
      test: this.options.test ?? /\.js$/,
      raw: true,
      banner: `(function () {
  // TODO: remove this after \`useModuleWrapper\` supports MTS
  var globDynamicComponentEntry = '__Card__';
  const module = { exports: {} }
  const exports = module.exports`,
    }).apply(compiler)
    new BannerPlugin({
      test: this.options.test ?? /\.js$/,
      raw: true,
      banner: `return module.exports
})()`,
      footer: true,
    }).apply(compiler)
  }
}
