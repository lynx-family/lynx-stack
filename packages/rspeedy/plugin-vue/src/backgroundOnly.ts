// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

/**
 * Apply background-only configuration for Vue components
 */
export function applyBackgroundOnly(api: RsbuildPluginAPI): void {
  // Configure background-only mode
  api.modifyBundlerChain((chain) => {
    // Configure the chain
    // Add background-only loader for .vue files with ?background query
    chain.module
      .rule('vue-background')
      .test(/\.vue\?background$/)
      .use('vue-background-loader')
      .loader('@lynx-js/vue-background-loader')
      .options({
        // Configure to only include script code
        scriptOnly: true,
      })

    // Return void instead of the chain to match the expected type
    return
  })
} 
