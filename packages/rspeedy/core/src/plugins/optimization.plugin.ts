// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginOptimization(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:optimization',
    setup(api) {
      api.modifyBundlerChain((chain, { CHAIN_ID, isProd }) => {
        const rule = chain.module.rules.get(CHAIN_ID.RULE.JS)
        chain
          .module
          .rule('js-override-strict')
          .type(rule.get('type') as string)
          .test(rule.get('test') as RegExp)
          // We do not directly apply this to `CHAIN_ID.RULE.JS` since it will not
          // includes the `node_modules` by default.
          .parser({
            // Make all the modules as strict to avoid entry being wrapped by IIFE.
            // See: https://github.com/webpack/webpack/discussions/18367
            overrideStrict: 'strict',
          })
          .end()

        if (isProd) {
          // Avoid entry being wrapped by IIFE
          // See: https://rspack.rs/config/optimization#optimizationavoidentryiife
          chain
            .optimization
            .avoidEntryIife(true)
        }
      })
    },
  }
}
