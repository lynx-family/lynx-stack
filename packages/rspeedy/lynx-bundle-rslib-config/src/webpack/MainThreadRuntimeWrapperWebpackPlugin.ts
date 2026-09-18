// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

const PLUGIN_NAME = 'MainThreadRuntimeWrapperWebpackPlugin'

/**
 * The options of {@link MainThreadRuntimeWrapperWebpackPlugin}.
 *
 * @public
 */
export interface MainThreadRuntimeWrapperWebpackPluginOptions {
  /**
   * Include the assets marked `lynx:main-thread` that pass test assertion.
   *
   * @defaultValue `/\.js$/`
   *
   * @public
   */
  test: Extract<Rspack.BannerPluginArgument, { banner: unknown }>['test']
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

  apply(compiler: Rspack.Compiler): void {
    const test = this.options.test ?? /\.js$/
    const header = `(function () {
  // TODO: remove this after \`useModuleWrapper\` supports MTS
  var globDynamicComponentEntry = '__Card__';
  const module = { exports: {} }
  const exports = module.exports`
    const footer = `return module.exports
})()`

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const { ModuleFilenameHelpers, sources: { ConcatSource } } =
        compiler.webpack
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_NONE,
        },
        () => {
          for (const asset of compilation.getAssets()) {
            if (!ModuleFilenameHelpers.matchObject({ test }, asset.name)) {
              continue
            }
            if (!asset.info['lynx:main-thread']) {
              continue
            }
            compilation.updateAsset(
              asset.name,
              (source) => new ConcatSource(header, '\n', source, '\n', footer),
            )
          }
        },
      )
    })

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
