// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

export function applyGenerator(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain({
    order: 'pre',
    handler: chain => {
      // Avoid generating `JSON.parse()` for a JSON file which has more than 20 characters as it increases the bundle size of `main-thread.js`.
      // For more detail, see https://github.com/webpack/webpack/issues/19319
      chain.module
        .rule(`json-parse:${LAYERS.MAIN_THREAD}`)
        .issuerLayer(LAYERS.MAIN_THREAD)
        .test(/\.json$/)
        .type('json')
        .generator({
          JSONParse: false,
        })
    },
  })
}
