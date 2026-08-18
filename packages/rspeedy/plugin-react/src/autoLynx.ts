// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { PLUGIN_LYNX_NAME, pluginLynx } from '@lynx-js/rsbuild-plugin'

// Calling `setup` does not register the plugins, so `PLUGIN_LYNX_NAME` cannot
// be used to tell that the engine was applied this way. The Rsbuild instance is
// tracked instead, so a second `pluginReactLynx` does not apply it again.
const applied = new WeakSet<object>()

// Rspeedy applies `pluginLynx` itself. With plain Rsbuild nothing does, so the
// build engine is applied here to keep `pluginReactLynx` the only plugin a user
// has to add.
export function pluginAutoLynx(): RsbuildPlugin {
  return {
    name: 'lynx:react:auto-lynx',
    async setup(api) {
      // The callers that do not emit a Lynx template do not want the engine
      // either. See the same condition in `applyEntry`.
      const { callerName } = api.context
      if (callerName === 'rslib' || callerName === 'rstest') {
        return
      }

      if (api.isPluginExists(PLUGIN_LYNX_NAME) || applied.has(api.context)) {
        return
      }
      applied.add(api.context)

      const original = api.getRsbuildConfig('original')

      for (const plugin of pluginLynx()) {
        // `setup` is called directly instead of registering the plugins, since
        // a plugin cannot add plugins. `apply` is honored here because Rsbuild
        // only evaluates it for registered plugins.
        const { action } = api.context
        if (
          typeof plugin.apply === 'function'
          && action !== undefined
          && !plugin.apply(original, { action })
        ) {
          continue
        }
        await plugin.setup(api)
      }
    },
  }
}
