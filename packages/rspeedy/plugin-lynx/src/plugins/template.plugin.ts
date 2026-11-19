// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin, RspackChain } from '@rsbuild/core'

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'

export function pluginTemplate(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:template',
    setup(api) {
      api.expose(Symbol.for('LynxTemplatePlugin'), { LynxTemplatePlugin })

      if (api.context.callerName !== 'rslib') {
        return
      }

      api.modifyBundlerChain((chain, { environment }) => {
        configureTemplate(chain, {
          target: environment.name === 'web' ? 'web' : 'lynx',
        })
      })
    },
  }
}

export function configureTemplate(
  chain: RspackChain,
  { target, backgroundAssets }: {
    target: 'lynx' | 'web'
    // Omit for rslib's default matching; an empty array means no background.
    backgroundAssets?: string[]
  },
): void {
  if (target === 'web') {
    if (!chain.plugins.has(PLUGIN_NAME_WEB)) {
      chain.plugin(PLUGIN_NAME_WEB).use(WebEncodePlugin, []).end()
    }
    return
  }

  if (
    (backgroundAssets === undefined || backgroundAssets.length > 0)
    && !chain.plugins.has(PLUGIN_NAME_RUNTIME_WRAPPER)
  ) {
    chain
      .plugin(PLUGIN_NAME_RUNTIME_WRAPPER)
      .use(RuntimeWrapperWebpackPlugin, [
        backgroundAssets === undefined ? {} : { test: backgroundAssets },
      ])
      .end()
  }

  if (!chain.plugins.has(LynxEncodePlugin.name)) {
    chain
      .plugin(LynxEncodePlugin.name)
      .use(LynxEncodePlugin, [{}])
      .end()
  }
}

const PLUGIN_NAME_RUNTIME_WRAPPER = 'lynx:runtime-wrapper'
const PLUGIN_NAME_WEB = 'lynx:web'
