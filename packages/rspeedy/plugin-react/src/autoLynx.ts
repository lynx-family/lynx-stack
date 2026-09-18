// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildContext, RsbuildPlugin } from '@rsbuild/core'

import { isPluginLynxRegistered, pluginLynx } from '@lynx-js/rsbuild-plugin'

// Rspeedy applies `pluginLynx` itself. Nothing does with plain Rsbuild or
// `rslib`, so the engine is applied here.
export function pluginAutoLynx(): RsbuildPlugin {
  return {
    name: 'lynx:react:auto-lynx',
    async setup(api) {
      // A test run has no bundle for the engine to configure.
      if (api.context.callerName === 'rstest') {
        return
      }

      const { environments } = api.getRsbuildConfig('original')
      if (isPluginLynxRegistered(api, Object.keys(environments ?? {}))) {
        return
      }

      const original = api.getRsbuildConfig('original')

      for (const plugin of pluginLynx()) {
        // A plugin cannot add plugins, so `setup` is called directly. That
        // skips the `apply` Rsbuild would evaluate for a registered plugin.
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
