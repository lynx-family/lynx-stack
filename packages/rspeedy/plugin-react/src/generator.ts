// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

import type { ResolvedPluginReactLynxOptions } from './pluginReactLynx.js'

export function applyGenerator(
  api: RsbuildPluginAPI,
  options: ResolvedPluginReactLynxOptions,
): void {
  api.modifyBundlerChain({
    order: 'pre',
    handler: chain => {
      // Avoid generating `JSON.parse()` for a JSON file which has more than 20 characters as it increases the bundle size of `main-thread.js`.
      // For more detail, see https://github.com/webpack/webpack/issues/19319
      const rule = chain.module
        .rule(`react:json-parse`)
        .test(/\.json$/)
        .type('json')
        .generator({
          JSONParse: false,
        })

      // If `extractStr` is enabled, we also need to apply the rule for both main thread and background thread.
      // It will ensure that string literals are same in both main thread and background thread.
      // Otherwise, we only apply the rule for main thread, because `JSON.parse` in background thread has better performance.
      if (!options.extractStr) {
        rule.issuerLayer(LAYERS.MAIN_THREAD)
      }
    },
  })
}
