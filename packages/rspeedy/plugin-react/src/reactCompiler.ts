// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

export function applyReactCompiler(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const {
    experimental_enableReactCompiler,
  } = options

  api.modifyBundlerChain((chain, { CHAIN_ID }) => {
    const rule = chain.module.rules.get(CHAIN_ID.RULE.JS)

    if (experimental_enableReactCompiler) {
      rule.use('react-compiler')
        .loader(ReactWebpackPlugin.loaders.REACT_COMPILER)
        .end()
    }
  })
}
