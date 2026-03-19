// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BannerPlugin, Compiler } from 'webpack'

const PLUGIN_NAME = 'MainThreadRuntimeWrapperWebpackPlugin'

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

    const { RuntimeGlobals, RuntimeModule } = compiler.webpack
    class LoadingConsumerModulesRuntimeModule extends RuntimeModule {
      constructor() {
        super(
          'Lynx externals loading consumer modules',
          RuntimeModule.STAGE_ATTACH,
        )
      }
      override generate() {
        return `
__webpack_require__.i.push(function (options) {
  var moduleId = options.id;
  var globalModules = globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')];
  if (globalModules && globalModules[moduleId]) {
    if (!options.factory) {
      options.factory = globalModules[moduleId];
    }
  }
});
`
      }
    }

    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development'

    if (isDev) {
      compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          PLUGIN_NAME,
          (_chunk, runtimeRequirements) => {
            runtimeRequirements.add(RuntimeGlobals.interceptModuleExecution)
          },
        )

        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.interceptModuleExecution)
          .tap(
            PLUGIN_NAME,
            (chunk) => {
              compilation.addRuntimeModule(
                chunk,
                new LoadingConsumerModulesRuntimeModule(),
              )
            },
          )
      })
    }
  }
}
