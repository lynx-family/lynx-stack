// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { LynxCacheEventsPlugin } from '@lynx-js/cache-events-webpack-plugin'
import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'

export function pluginChunkLoading(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:chunk-loading',
    setup(api) {
      api.modifyBundlerChain((chain) => {
        // dprint-ignore
        chain
        .plugin('lynx:chunk-loading')
          .use(ChunkLoadingWebpackPlugin)
        .end()
        .plugin('lynx:cache-events')
          .use(LynxCacheEventsPlugin)
        .end()
        .output
          .chunkLoading('lynx')
          .chunkFormat('commonjs')
        .end()
      })
    },
  }
}
