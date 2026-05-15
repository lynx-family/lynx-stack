// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'
import color from 'picocolors'
import link from 'terminal-link'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { LynxDebugMetadataPlugin } from './LynxDebugMetadataPlugin.js'

const PLUGIN_NAME = 'lynx:debug-metadata'

const DEFAULT_DSL_PLUGIN_NAME_TO_PKG_NAME = {
  'lynx:react': '@lynx-js/react-rsbuild-plugin',
}

const DEFAULT_UPGRADE_RSPEEDY_LINK =
  'https://www.npmjs.com/package/upgrade-rspeedy'

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: typeof LynxTemplatePlugin
}

/**
 * Register `debug-metadata.json` emission for every Lynx template build.
 *
 * Auto-registered by Rspeedy core. Behaviour when no `LynxTemplatePlugin`
 * exposure is found:
 *
 * - If a known Lynx DSL plugin (e.g. `pluginReactLynx`) is loaded, throw
 *   fast — the DSL plugin is expected to publish the exposure and the
 *   most likely cause is an outdated DSL plugin version.
 * - Otherwise stay silent — the project is either a non-Lynx Rspeedy
 *   build or a test harness running `rspeedy build` without any DSL, and
 *   debug metadata has nothing meaningful to emit.
 *
 * @public
 */
export function pluginLynxDebugMetadata(): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    setup(api) {
      api.modifyBundlerChain((chain, { environment }) => {
        const exposed = api.useExposed<LynxTemplatePluginExposure>(
          Symbol.for('LynxTemplatePlugin'),
        )

        if (!exposed) {
          const activeDslPluginPkgName = findActiveDslPluginPkgName(api)
          if (activeDslPluginPkgName === undefined) {
            // No DSL plugin loaded → not a Lynx project, skip silently.
            return
          }

          throw new Error(
            `\
[${PLUGIN_NAME}] No \`LynxTemplatePlugin\` exposed to ${
              link(
                'the plugin API',
                'https://rsbuild.rs/plugins/dev/core#apiexpose',
              )
            }.

Please upgrade ${activeDslPluginPkgName} to latest version.

See ${
              link(
                color.yellow('Upgrade Rspeedy'),
                DEFAULT_UPGRADE_RSPEEDY_LINK,
              )
            } for more details.
`,
          )
        }

        chain.plugin(PLUGIN_NAME).use(LynxDebugMetadataPlugin, [{
          LynxTemplatePlugin: exposed.LynxTemplatePlugin,
          rsbuildEntry: environment.entry,
        }])
      })
    },
  }
}

function findActiveDslPluginPkgName(api: {
  isPluginExists(name: string): boolean
}): string | undefined {
  for (
    const [dslPluginName, pluginPkgName] of Object.entries(
      DEFAULT_DSL_PLUGIN_NAME_TO_PKG_NAME,
    )
  ) {
    if (api.isPluginExists(dslPluginName)) {
      return pluginPkgName
    }
  }
  return undefined
}
