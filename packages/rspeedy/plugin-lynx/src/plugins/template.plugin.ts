// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
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
        if (environment.name !== 'lynx') {
          return
        }

        if (!chain.plugins.has(PLUGIN_NAME_RUNTIME_WRAPPER)) {
          chain
            .plugin(PLUGIN_NAME_RUNTIME_WRAPPER)
            .use(RuntimeWrapperWebpackPlugin, [{}])
            .end()
        }

        if (!chain.plugins.has(LynxEncodePlugin.name)) {
          chain
            .plugin(LynxEncodePlugin.name)
            .use(LynxEncodePlugin, [{}])
            .end()
        }
      })
    },
  }
}

const PLUGIN_NAME_RUNTIME_WRAPPER = 'lynx:runtime-wrapper'
