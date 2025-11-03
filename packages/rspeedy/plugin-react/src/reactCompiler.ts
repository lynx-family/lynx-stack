// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

export function applyReactCompiler(
  api: RsbuildPluginAPI,
): void {
  api.modifyBundlerChain((chain) => {
    const rule = chain.module.rule('react:compiler')
    rule
      .test(/\.[jt]sx$/)
      .use('ReactCompiler')
      .loader(ReactWebpackPlugin.loaders.REACT_COMPILER)
      .end()
  })
}
