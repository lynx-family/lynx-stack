// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { getESVersionTarget } from '../utils/getESVersionTarget.js'
import { isWeb } from '../utils/is-web.js'

export function pluginTarget(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:target',
    setup(api) {
      api.modifyBundlerChain((options, { environment }) => {
        if (isWeb(environment)) {
          options.target([
            getESVersionTarget(),
            // Currently, Rsbuild won't inject HMR related code for `webworker`.
            // See: https://github.com/web-infra-dev/rsbuild/blob/9c1652819e00ee12a213df30d81b6c23f9e4c0d2/packages/core/src/server/compilationMiddleware.ts#L16
            'webworker',
          ])
        } else {
          options.target([getESVersionTarget()])
        }
      })
    },
  }
}
