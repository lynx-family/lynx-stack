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
import type { LynxTemplatePluginOptions } from '@lynx-js/template-webpack-plugin'

import { isLynx } from '../utils/is-lynx.js'

export function pluginTemplate(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:template',
    setup(api) {
      api.expose(Symbol.for('LynxTemplatePlugin'), { LynxTemplatePlugin })

      if (api.context.callerName === 'rslib') {
        api.modifyBundlerChain((chain, { environment }) => {
          configureTemplate(chain, {
            target: environment.name === 'web' ? 'web' : 'lynx',
          })
        })
        return
      }

      if (api.context.callerName === 'rstest') return
      api.modifyBundlerChain({
        order: 'post',
        handler(chain, { environment }) {
          // Resource DSLs register templates without app entry chunks. They use
          // the same encode/emit hooks as pages, without a background wrapper.
          const hasResourceTemplate = chain.plugins.values().some(plugin => {
            const options = (plugin.get('args') as
              | [LynxTemplatePluginOptions]
              | undefined)?.[0]
            return plugin.get('plugin') === LynxTemplatePlugin
              && Array.isArray(options?.chunks) && options.chunks.length === 0
          })
          if (!hasResourceTemplate) return
          let target: 'lynx' | 'web'
          if (isLynx(environment.name)) target = 'lynx'
          else if (
            environment.name === 'web' || environment.name.startsWith('web-')
          ) target = 'web'
          else return
          configureTemplate(chain, { target, backgroundAssets: [] })
        },
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
