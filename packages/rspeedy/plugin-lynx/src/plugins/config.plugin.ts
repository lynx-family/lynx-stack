// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { LYNX_CONFIG, createLynxConfig } from '../config.js'
import type { LynxPluginOptions } from '../config.js'

export function pluginConfig(options: LynxPluginOptions): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:config',
    setup(api) {
      api.expose(LYNX_CONFIG, createLynxConfig(options))
    },
  }
}
