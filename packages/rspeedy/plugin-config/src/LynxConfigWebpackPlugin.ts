// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import pick from 'object.pick'
import type { Compiler } from 'webpack'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

export class LynxConfigWebpackPlugin<Config extends object> {
  constructor(
    private options: {
      LynxTemplatePlugin: typeof LynxTemplatePlugin
      config: Config
      compilerOptionsKeys: string[]
      configKeys: string[]
    },
  ) {}

  name = 'LynxConfigWebpackPlugin'

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      const hooks = this.options.LynxTemplatePlugin.getLynxTemplatePluginHooks(
        compilation,
      )

      hooks.beforeEncode.tap(this.name, (args) => {
        const { config } = this.options

        args.encodeData.compilerOptions = {
          ...args.encodeData.compilerOptions,
          ...pick(config, this.options.compilerOptionsKeys as (keyof Config)[]),
        }

        args.encodeData.sourceContent.config = {
          ...args.encodeData.sourceContent.config,
          ...pick(config, this.options.configKeys as (keyof Config)[]),
        }

        return args
      })
    })
  }
}
