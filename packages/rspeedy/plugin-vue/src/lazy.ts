// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'
import type { PluginVueLynxOptions } from './pluginVueLynx.js'

// Define a fallback plugin class
class VueLazyWebpackPlugin {
  constructor(options: any) {
    console.warn('Using fallback VueLazyWebpackPlugin. For full functionality, please install @lynx-js/vue-lazy-webpack-plugin');
    this.options = options;
  }

  options: any;

  apply(compiler: any) {
    // Fallback implementation that does nothing
    // This allows the build to succeed even without the actual plugin
  }
}

/**
 * Apply lazy loading configuration for Vue components
 */
export function applyLazy(
  api: RsbuildPluginAPI,
  options: Required<PluginVueLynxOptions>,
): void {
  // Skip if lazy loading is not enabled
  if (!options.experimental_isLazyBundle) {
    return
  }
}
