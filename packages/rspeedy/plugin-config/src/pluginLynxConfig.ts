// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import color from 'picocolors'
import link from 'terminal-link'

import type { RsbuildPlugin } from '@lynx-js/rspeedy'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
import type {
  CompilerOptions as LynxCompilerOptions,
  Config as LynxConfig,
} from '@lynx-js/type-config'
import {
  compilerOptionsKeys as defaultCompilerOptionsKeys,
  configKeys as defaultConfigKeys,
} from '@lynx-js/type-config'

import { LynxConfigWebpackPlugin } from './LynxConfigWebpackPlugin.js'
import { validate as defaultValidate } from './validate.js'

const defaultDslPluginName2PkgName = {
  'lynx:react': '@lynx-js/react-rsbuild-plugin',
}
const defaultUpgradeRspeedyLink =
  'https://www.npmjs.com/package/upgrade-rspeedy'

/**
 * A configuration interface for Lynx Config defined by `@lynx-js/type-config`.
 *
 * See all available options in {@link https://lynxjs.org/next/api/lynx-config/config-reference.html}.
 *
 * @public
 */
export interface Config extends LynxConfig, LynxCompilerOptions {}

/**
 * Options for the Lynx Config rsbuild plugin.
 *
 * @public
 */
export interface Options {
  /**
   * The keys of compiler options to set.
   */
  compilerOptionsKeys?: string[]
  /**
   * The keys of config options to set.
   */
  configKeys?: string[]
  /**
   * Custom validation function for the Lynx config.
   *
   * @param input - The input to validate.
   * @returns The validated Lynx config.
   */
  validate?: (input: unknown) => Config
  /**
   * A map from DSL plugin name to its package name.
   *
   * @example
   * ```ts
   * {
   *   'lynx:react': '@lynx-js/react-rsbuild-plugin',
   * }
   * ```
   */
  dslPluginName2PkgName?: Record<string, string>
  /**
   * The link to upgrade Rspeedy.
   */
  upgradeRspeedyLink?: string
}

/**
 * An rsbuild plugin for config Lynx Config defined by `@lynx-js/type-config`.
 *
 * @param config - The Lynx config to set.
 *
 * @example
 * ```ts
 * import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
 * import { defineConfig } from '@lynx-js/rspeedy'
 *
 * export default defineConfig({
 *   plugins: [
 *     pluginLynxConfig({
 *       enableCheckExposureOptimize: false,
 *     }),
 *   ],
 * })
 * ```
 *
 * @public
 */
export function pluginLynxConfig(
  config: Config,
  options?: Options,
): RsbuildPlugin {
  const {
    compilerOptionsKeys = defaultCompilerOptionsKeys,
    configKeys = defaultConfigKeys,
    validate = defaultValidate,
    dslPluginName2PkgName = defaultDslPluginName2PkgName,
    upgradeRspeedyLink = defaultUpgradeRspeedyLink,
  } = options ?? {}

  validate(config)

  return {
    name: 'lynx:config',
    async setup(api) {
      api.expose(Symbol.for('lynx.config'), { config })

      api.modifyBundlerChain(chain => {
        const exposed = api.useExposed<
          { LynxTemplatePlugin: typeof LynxTemplatePlugin }
        >(
          Symbol.for('LynxTemplatePlugin'),
        )

        if (!exposed) {
          let pkgName = 'Rspeedy and plugins'

          Object.entries(dslPluginName2PkgName).forEach(
            ([dslPluginName, pluginPkgName]) => {
              if (api.isPluginExists(dslPluginName)) {
                pkgName = pluginPkgName
              }
            },
          )

          throw new Error(
            `\
[pluginLynxConfig] No \`LynxTemplatePlugin\` exposed to ${
              link(
                'the plugin API',
                'https://rsbuild.rs/plugins/dev/core#apiexpose',
              )
            }.

Please upgrade ${pkgName} to latest version.

See ${
              link(
                color.yellow('Upgrade Rspeedy'),
                upgradeRspeedyLink,
              )
            } for more details.
`,
          )
        }

        const { LynxTemplatePlugin: LynxTemplatePluginClass } = exposed

        chain.plugin('lynx:config').use(LynxConfigWebpackPlugin<Config>, [
          {
            LynxTemplatePlugin: LynxTemplatePluginClass,
            config,
            compilerOptionsKeys,
            configKeys,
          },
        ])
      })
    },
  }
}
