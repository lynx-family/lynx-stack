// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

const INTERMEDIATE = '.rspeedy'

/**
 * Route a lazy bundle's intermediate JS chunk to
 * `.rspeedy/async/<name>/<layer>.js`, co-located with the bundle's other
 * intermediate outputs (mirroring `.rspeedy/main/`). Non-lazy chunks keep the
 * default `output.chunkFilename`.
 */
class AsyncChunkLayoutPlugin {
  apply(compiler: Rspack.Compiler): void {
    const original = compiler.options.output.chunkFilename
    let compilation: Rspack.Compilation | undefined
    compiler.hooks.thisCompilation.tap('AsyncChunkLayoutPlugin', c => {
      compilation = c
    })

    compiler.options.output.chunkFilename = (pathData, assetInfo) => {
      const id = pathData.chunk?.id
      if (compilation !== undefined && id !== undefined && id !== null) {
        const layoutName = LynxTemplatePlugin.getAsyncChunkLayoutName(
          compilation as unknown as Parameters<
            typeof LynxTemplatePlugin.getAsyncChunkLayoutName
          >[0],
          id,
        )
        if (layoutName !== undefined) {
          return `${INTERMEDIATE}/async/${layoutName}.js`
        }
      }
      return typeof original === 'function'
        ? original(pathData, assetInfo)
        : original ?? '[id].js'
    }
  }
}

export function applyAsyncChunkLayout(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain((chain) => {
    chain.plugin('lynx:async-chunk-layout').use(AsyncChunkLayoutPlugin)
  })
}
