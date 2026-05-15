// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'
import color from 'picocolors'
import link from 'terminal-link'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import {
  DEBUG_METADATA_ASSET_NAME,
  LynxDebugMetadataPlugin,
} from './LynxDebugMetadataPlugin.js'
import { createDebugMetadataMiddleware } from './middleware.js'
import type { CompilerHandle } from './middleware.js'

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
 * Register `debug-metadata.json` emission for every Lynx template build
 * and serve sub-field queries via a connect-style dev-server middleware.
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
 * The dev-server middleware exposes these endpoints (relative to each
 * entry's intermediate dir):
 *
 * ```text
 * GET .../debug-metadata.json
 * GET .../debug-metadata.json?field=source-map&path=…
 * GET .../debug-metadata.json?field=source-map&filename=…
 * GET .../debug-metadata.json?field=source-map&key=…
 * GET .../debug-metadata.json?field=bytecode-debug-info&filename=…
 * GET .../debug-metadata.json?field=artifact&filename=…
 * GET .../debug-metadata.json?field=artifacts
 * GET .../debug-metadata.json?field=ui-source-map
 * GET .../debug-metadata.json?field=meta
 * GET .../debug-metadata.json?field=git
 * GET .../debug-metadata.json?field=rspeedy
 *
 * GET .../*.js.map    → transparently forwarded to ?field=source-map
 * GET .../*.css.map   → transparently forwarded to ?field=source-map
 * ```
 *
 * @public
 */
export function pluginLynxDebugMetadata(): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    setup(api) {
      const compilerHandle: CompilerHandle = { compiler: null }

      api.onAfterCreateCompiler(({ compiler }) => {
        compilerHandle.compiler = compiler as unknown as CompilerHandle[
          'compiler'
        ]
      })

      api.modifyBundlerChain((chain, { environment }) => {
        const exposed = api.useExposed<LynxTemplatePluginExposure>(
          Symbol.for('LynxTemplatePlugin'),
        )

        if (!exposed) {
          const activeDslPluginPkgName = findActiveDslPluginPkgName(api)
          if (activeDslPluginPkgName === undefined) {
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

      api.onBeforeStartDevServer(({ server }) => {
        const mw = createDebugMetadataMiddleware({
          debugMetadataAssetName: DEBUG_METADATA_ASSET_NAME,
          compilerHandle,
        })
        ;(server as {
          middlewares: { use: (fn: typeof mw) => void }
        }).middlewares.use(mw)
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
