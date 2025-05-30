// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

/**
 * Apply Vue-specific aliases
 */
export function applyAlias(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain((chain) => {
    // Configure the chain
    // Add Vue-specific aliases
    chain.resolve.alias.set('vue', '@lynx-js/vue')

    // Return void instead of the chain to match the expected type
    return
  })
} 
