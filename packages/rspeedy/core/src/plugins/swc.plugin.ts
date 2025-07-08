// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { getESVersionTarget } from '../utils/getESVersionTarget.js'

export function pluginSwc(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:swc',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const isProd = config.mode === 'production'
        return mergeRsbuildConfig(config, {
          tools: {
            swc(config) {
              delete config.env

              config.jsc ??= {}

              // TODO(target): use configuration
              config.jsc.target = getESVersionTarget(isProd)
            },
          },
        })
      })
    },
  }
}
