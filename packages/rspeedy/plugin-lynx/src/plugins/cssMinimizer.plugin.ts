// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginCssMinimizer(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:css-minimizer',
    async setup(api) {
      // If no `@rsbuild/plugin-css-minimizer` is applied, apply it
      const { pluginCssMinimizer, PLUGIN_CSS_MINIMIZER_NAME } = await import(
        '@rsbuild/plugin-css-minimizer'
      )
      if (!api.isPluginExists(PLUGIN_CSS_MINIMIZER_NAME)) {
        await pluginCssMinimizer().setup(api)
      }
    },
  }
}
