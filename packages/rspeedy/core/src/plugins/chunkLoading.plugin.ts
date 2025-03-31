// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'

import { isLynx } from '../utils/is-lynx.js'
import { isWeb } from '../utils/is-web.js'

export function pluginChunkLoading(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:chunk-loading',
    setup(api) {
      api.modifyBundlerChain((chain, { environment }) => {
        if (isWeb(environment)) {
          chain
            .output
            .chunkLoading('import-scripts')
            .end()
          return
        }

        if (isLynx(environment)) {
          // dprint-ignore
          chain
          .plugin('lynx:chunk-loading')
            .use(ChunkLoadingWebpackPlugin)
          .end()
          .output
            .chunkLoading('lynx')
            .chunkFormat('commonjs')
            .iife(false)
          .end()
        }
      })
    },
  }
}
