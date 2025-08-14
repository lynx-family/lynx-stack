// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applyRstest(api: RsbuildPluginAPI): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig({
      output: {
        // Allow using Node.js internal modules in testing framework directly
        externals: /^node:/,
      },
    }, config)
  })
}
