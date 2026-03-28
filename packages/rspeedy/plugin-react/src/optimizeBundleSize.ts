// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

export function applyOptimizeBundleSize(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    const optimizeBundleSize = options.optimizeBundleSize
    const optimizeBackground = typeof optimizeBundleSize === 'boolean'
      ? optimizeBundleSize
      : optimizeBundleSize?.background
    const optimizeMainThread = typeof optimizeBundleSize === 'boolean'
      ? optimizeBundleSize
      : optimizeBundleSize?.mainThread

    if (optimizeBackground || optimizeMainThread) {
      const minifyConfig: Record<string, unknown> = {}

      if (optimizeBackground) {
        minifyConfig['backgroundOptions'] = {
          minimizerOptions: {
            compress: {
              pure_funcs: ['lynx.registerDataProcessors'],
            },
          },
        }
      }

      if (optimizeMainThread) {
        minifyConfig['mainThreadOptions'] = {
          minimizerOptions: {
            compress: {
              pure_funcs: ['NativeModules.call', 'lynx.getJSModule'],
            },
          },
        }
      }

      return mergeRsbuildConfig(config, {
        output: {
          minify: minifyConfig,
        },
      })
    }

    return config
  })
}
