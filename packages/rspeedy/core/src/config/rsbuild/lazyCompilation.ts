// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import type { Rspack } from '@rsbuild/core'

import type { LazyCompilationOptions } from '../dev/lazyCompilation.js'

const __filename = fileURLToPath(import.meta.url)
const require = createRequire(__filename)

export function toRsbuildLazyCompilation(
  options: boolean | LazyCompilationOptions | undefined,
):
  | boolean
  | Rspack.LazyCompilationOptions
{
  if (!options) return false

  const defaultOptions: Rspack.LazyCompilationOptions = {
    test: module => {
      const HMRModules = [
        '@rspack/core/hot/dev-server.js',
        'webpack-dev-transport/lib/client/index.js',
      ]

      const isHMRImports = HMRModules.some(m =>
        module?.nameForCondition()?.endsWith(m)
      )

      const isBackground = module?.layer === 'react:background'

      return isBackground && !isHMRImports
    },
    client: require.resolve(
      '../../../hot/lazy-compilation-fetch.js',
    ),

    // Dynamic imports will be encoded into lynx.bundle
    imports: false,
  }

  if (options === true) return defaultOptions

  return {
    ...defaultOptions,
    ...options,
  }
}
