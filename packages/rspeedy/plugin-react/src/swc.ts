// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applySWC(api: RsbuildPluginAPI): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig(config, {
      tools: {
        swc(config) {
          config.jsc ??= {}
          config.jsc.transform ??= {}
          config.jsc.transform.useDefineForClassFields = false
          config.jsc.transform.optimizer ??= {}
          config.jsc.transform.optimizer.simplify = true

          config.jsc.parser ??= {
            syntax: 'typescript',
          }
          if (config.jsc.parser.syntax === 'typescript') {
            config.jsc.parser.tsx = false
            config.jsc.parser.decorators = true
          }

          config.jsc.experimental ??= {}
          config.jsc.experimental.plugins ??= []

          return config
        },
      },
    })
  })
}
