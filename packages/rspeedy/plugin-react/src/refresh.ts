// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
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

export function applyRefresh(api: RsbuildPluginAPI): void {
  api.modifyWebpackChain(async (chain, { CHAIN_ID, isProd }) => {
    if (!isProd) {
      await applyRefreshRules(api, chain, CHAIN_ID, ReactRefreshWebpackPlugin)
    }
  })

  api.modifyBundlerChain(async (chain, { isProd, CHAIN_ID }) => {
    if (!isProd) {
      // biome-ignore lint/correctness/useHookAtTopLevel: not react hooks
      const { resolve } = api.useExposed<
        { resolve: (request: string) => Promise<string> }
      >(Symbol.for('@lynx-js/react/internal:resolve'))!

      await Promise.all([
        applyRefreshRules(api, chain, CHAIN_ID, ReactRefreshRspackPlugin),
        resolve('@lynx-js/react/refresh').then(refresh => {
          chain.resolve.alias.set('@lynx-js/react/refresh$', refresh)
        }),
      ])
    }
  })
}

async function applyRefreshRules<Bundler extends 'webpack' | 'rspack'>(
  api: RsbuildPluginAPI,
  chain: RspackChain,
  CHAIN_ID: ChainIdentifier,
  ReactRefreshPlugin: Bundler extends 'rspack' ? typeof ReactRefreshRspackPlugin
    : typeof ReactRefreshWebpackPlugin,
) {
  // biome-ignore lint/correctness/useHookAtTopLevel: not react hooks
  const { resolve } = api.useExposed<
    { resolve: (request: string) => Promise<string> }
  >(Symbol.for('@lynx-js/react/internal:resolve'))!

  const [reactRuntime, refresh, workletRuntime] = await Promise.all([
    resolve('@lynx-js/react/package.json'),
    resolve('@lynx-js/react/refresh'),
    resolve('@lynx-js/react/worklet-runtime'),
  ])

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
          .add(path.dirname(reactRuntime))
          .add(path.dirname(refresh))
          .add(path.dirname(workletRuntime))
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
