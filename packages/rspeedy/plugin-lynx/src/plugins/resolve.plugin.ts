// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginResolve(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:resolve',
    setup(api) {
      api.modifyBundlerChain(chain => {
        // dprint-ignore
        chain
          .resolve
            .aliasFields
              .add('browser')
            .end()
            .conditionNames
              .add('lynx')
              .add('import')
              .add('require')
              .add('browser')
            .end()
            .extensions
              // Rsbuild's default is ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json']
              // We only append `.cjs` with it.
              .add('.cjs')
            .end()
            .mainFields
              .add('lynx')
              .add('module')
              .add('main')
            .end()
            .mainFiles
              .add('index.lynx')
              .add('index')
            .end()
          .end()
        .end()
      })
    },
  }
}
