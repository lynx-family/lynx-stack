// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginEmitOnErrors(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:emit-on-errors',
    setup(api) {
      api.modifyBundlerChain((chain) => {
        chain.optimization.emitOnErrors(true)
      })
    },
  }
}
