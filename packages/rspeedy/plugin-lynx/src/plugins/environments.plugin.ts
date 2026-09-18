// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginEnvironments(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:environments',
    setup(api) {
      api.modifyRsbuildConfig({
        handler: (config, { mergeRsbuildConfig }) =>
          api.getRsbuildConfig('original').environments === undefined
            ? mergeRsbuildConfig(config, { environments: { lynx: {} } })
            : config,
        order: 'pre',
      })
    },
  }
}
