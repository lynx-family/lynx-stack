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
            // Add `target: 'web'` to make Rsbuild inject HMR related code.
            'web',
          ])
        } else {
          options.target([getESVersionTarget()])
        }
      })
    },
  }
}
