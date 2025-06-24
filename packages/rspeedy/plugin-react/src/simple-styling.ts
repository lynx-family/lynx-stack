// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'
import path from 'node:path'

import type {
  ChainIdentifier,
  RsbuildPluginAPI,
  RspackChain,
} from '@rsbuild/core'

import {
  ReactSimpleStylingWebpackPlugin,
} from '@lynx-js/react-simple-styling-webpack-plugin'

const PLUGIN_NAME_REACT_SIMPLE_STYLING = 'lynx:react:simple-styling'
const require = createRequire(import.meta.url)

export function applySimpleStyling(api: RsbuildPluginAPI): void {
  api.modifyWebpackChain((chain, { CHAIN_ID, isProd }) => {
    if (isProd) {
      applySimpleStylingRules(
        chain,
        CHAIN_ID,
      )
    }
  })
  api.modifyBundlerChain((chain, { CHAIN_ID, isProd }) => {
    if (isProd) {
      applySimpleStylingRules(
        chain,
        CHAIN_ID,
      )
    }
  })
}

function applySimpleStylingRules(
  chain: RspackChain,
  CHAIN_ID: ChainIdentifier,
) {
  // dprint-ignore
  chain
    .plugin(PLUGIN_NAME_REACT_SIMPLE_STYLING)
    .use(ReactSimpleStylingWebpackPlugin)
  .end()
    .module
      .rule('react:simple-styling')
      .before(CHAIN_ID.RULE.JS)
      .test(/\.[jt]sx$/)
      .exclude
        .add(/node_modules/)
        .add(path.dirname(require.resolve('@lynx-js/react/package.json')))
        .add(path.dirname(require.resolve('@lynx-js/react/refresh')))
        .add(path.dirname(require.resolve('@lynx-js/react/worklet-runtime')))
        .end()
        .use('ReactSimpleStyling')
          .loader(ReactSimpleStylingWebpackPlugin.loader)
          .options({})
        .end()
      .end()
    .end()
  .end()
}
