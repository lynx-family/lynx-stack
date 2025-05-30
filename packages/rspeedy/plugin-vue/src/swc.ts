// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

/**
 * Apply SWC configuration for Vue components
 */
export function applySWC(api: RsbuildPluginAPI): void {
  // Configure SWC
  api.modifyRsbuildConfig((config) => {
    // Enable SWC
    if (!config.tools) {
      config.tools = {}
    }

    if (!config.tools.swc) {
      config.tools.swc = {}
    }

    // Configure SWC for Vue
    config.tools.swc = {
      ...config.tools.swc,
      // Configure JSX transformation using the jsc property
      jsc: {
        ...(config.tools.swc.jsc || {}),
        transform: {
          ...((config.tools.swc.jsc as any)?.transform || {}),
          react: {
            runtime: 'automatic',
            importSource: '@lynx-js/vue',
          }
        }
      }
    }

    return config
  })
} 
