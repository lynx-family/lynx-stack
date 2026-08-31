// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RsbuildConfig,
  RsbuildContext,
  RsbuildPlugin,
} from '@rsbuild/core'

import { PLUGIN_LYNX_NAME, pluginLynx } from '@lynx-js/rsbuild-plugin'

// Calling `setup` does not register the plugins, so `PLUGIN_LYNX_NAME` cannot
// be used to tell that the engine was applied this way. The context is marked
// instead. `Symbol.for` keeps the marker shared with any other copy of this
// package, and with any other plugin that applies the engine the same way.
const S_PLUGIN_LYNX_APPLIED = Symbol.for('@lynx-js/rsbuild-plugin:applied')

// Without an environment, `isPluginExists` only reports the global plugins, so
// an engine registered per environment — which is how `rslib` passes the
// plugins of a lib entry along — would be applied a second time here.
function isEngineRegistered(
  api: Parameters<NonNullable<RsbuildPlugin['setup']>>[0],
  original: RsbuildConfig,
): boolean {
  return api.isPluginExists(PLUGIN_LYNX_NAME)
    || Object.keys(original.environments ?? {}).some(environment =>
      api.isPluginExists(PLUGIN_LYNX_NAME, { environment })
    )
}

// Rspeedy applies `pluginLynx` itself. With plain Rsbuild nothing does, so the
// build engine is applied here to keep `pluginReactLynx` the only plugin a user
// has to add.
export function pluginAutoLynx(): RsbuildPlugin {
  return {
    name: 'lynx:react:auto-lynx',
    async setup(api) {
      // `rslib` and `rstest` drive the build themselves — an external bundle
      // assembles its own `.lynx.bundle`, and a test run emits nothing — so
      // the engine has nothing to add. See the same condition in `applyEntry`.
      const { callerName } = api.context
      if (callerName === 'rslib' || callerName === 'rstest') {
        return
      }

      const original = api.getRsbuildConfig('original')

      if (
        isEngineRegistered(api, original)
        || Object.hasOwn(api.context, S_PLUGIN_LYNX_APPLIED)
      ) {
        return
      }
      Object.defineProperty(api.context, S_PLUGIN_LYNX_APPLIED, { value: true })

      for (const plugin of pluginLynx()) {
        // `setup` is called directly instead of registering the plugins, since
        // a plugin cannot add plugins. `apply` is honored here because Rsbuild
        // only evaluates it for registered plugins.
        // `action` is only set once a build or a server starts, and Rsbuild
        // passes it along as-is, so it is passed along the same way here.
        const { action } = api.context
        if (
          typeof plugin.apply === 'function'
          && !plugin.apply(original, { action } as Pick<
            RsbuildContext,
            'action'
          >)
        ) {
          continue
        }
        await plugin.setup(api)
      }
    },
  }
}
