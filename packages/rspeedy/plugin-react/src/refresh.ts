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
  ReactRefreshRspackPlugin,
  ReactRefreshWebpackPlugin,
} from '@lynx-js/react-refresh-webpack-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'

const PLUGIN_NAME_REACT_REFRESH = 'lynx:react:refresh'
const require = createRequire(import.meta.url)

export function applyRefresh(api: RsbuildPluginAPI): void {
  api.modifyWebpackChain((chain, { CHAIN_ID, isProd }) => {
    if (!isProd) {
      applyRefreshRules(chain, CHAIN_ID, ReactRefreshWebpackPlugin)
    }
  })

  api.modifyBundlerChain((chain, { isProd, CHAIN_ID }) => {
    if (!isProd) {
      applyRefreshRules(chain, CHAIN_ID, ReactRefreshRspackPlugin)

      chain
        .resolve
        .alias
        .set(
          '@lynx-js/react/refresh$',
          require.resolve('@lynx-js/react/refresh'),
        )
        .end()
    }
  })
}

function applyRefreshRules<Bundler extends 'webpack' | 'rspack'>(
  chain: RspackChain,
  CHAIN_ID: ChainIdentifier,
  ReactRefreshPlugin: Bundler extends 'rspack' ? typeof ReactRefreshRspackPlugin
    : typeof ReactRefreshWebpackPlugin,
) {
  // Place the ReactRefreshRspackPlugin at beginning to make the `react-refresh`
  // being injected at first.
  // dprint-ignore
  chain
    .plugin(PLUGIN_NAME_REACT_REFRESH)
    .before(CHAIN_ID.PLUGIN.HMR)
    .use(ReactRefreshPlugin)
  .end()
    .module
      .rule('react:refresh')
        .issuerLayer(LAYERS.BACKGROUND)
        .before(CHAIN_ID.RULE.JS)
        .test(/\.[jt]sx$/)
        .exclude
          .add(/node_modules/)
          .add(path.dirname(require.resolve('@lynx-js/react/package.json')))
          .add(path.dirname(require.resolve('@lynx-js/react/refresh')))
          .add(path.dirname(require.resolve('@lynx-js/react/worklet-runtime')))
          .add(ReactRefreshPlugin.loader)
        .end()
        .use('ReactRefresh')
          .loader(ReactRefreshPlugin.loader)
          .options({})
        .end()
      .end()
    .end()
  .end()
}
