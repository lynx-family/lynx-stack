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
 * Auto-registered by Rspeedy core. Requires a Lynx DSL plugin (e.g.
 * `pluginReactLynx`) to be present so that `LynxTemplatePlugin` is
 * exposed — otherwise the setup fails fast with a pointer to upgrade.
 *
 * @public
 */
export function pluginLynxDebugMetadata(): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    setup(api) {
      api.modifyBundlerChain(chain => {
        const exposed = api.useExposed<LynxTemplatePluginExposure>(
          Symbol.for('LynxTemplatePlugin'),
        )

        if (!exposed) {
          let pkgName = 'Rspeedy and plugins'

          Object.entries(DEFAULT_DSL_PLUGIN_NAME_TO_PKG_NAME).forEach(
            ([dslPluginName, pluginPkgName]) => {
              if (api.isPluginExists(dslPluginName)) {
                pkgName = pluginPkgName
              }
            },
          )

          throw new Error(
            `\
[${PLUGIN_NAME}] No \`LynxTemplatePlugin\` exposed to ${
              link(
                'the plugin API',
                'https://rsbuild.rs/plugins/dev/core#apiexpose',
              )
            }.

Please upgrade ${pkgName} to latest version.

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
        }])
      })
    },
  }
}
