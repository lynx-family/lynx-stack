// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

/**
 * Apply split chunks configuration for Vue components
 */
export function applySplitChunksRule(api: RsbuildPluginAPI): void {
  // Configure split chunks
  api.modifyBundlerChain((chain) => {
    // Get the optimization configuration
    const optimization = chain.optimization

    // Configure split chunks
    optimization.splitChunks({
      // Configure caching groups
      cacheGroups: {
        // Extract Vue runtime into a separate chunk
        vueRuntime: {
          test: /[\\/]node_modules[\\/](@vue|vue)[\\/]/,
          name: 'vue-runtime',
          chunks: 'all',
          priority: 10,
        },
        // Extract common dependencies into a separate chunk
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: -10,
        },
        // Extract common code into a separate chunk
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    })

    return chain
  })
} 
