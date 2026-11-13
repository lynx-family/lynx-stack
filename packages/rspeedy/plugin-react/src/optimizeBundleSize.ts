// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ModifyEnvironmentConfigFn, RsbuildPluginAPI } from '@rsbuild/core'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

export function applyOptimizeBundleSize(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const handler: ModifyEnvironmentConfigFn = (config, utils) => {
    const { name, mergeEnvironmentConfig } = utils
    const currentConfig = api.getRsbuildConfig('current')
    const environmentMinify = currentConfig.environments?.[name]?.output
      ?.minify
    const hookEnabledMinify = currentConfig.output?.minify !== true
      && config.output?.minify === true
    if (
      config.output?.minify === false
      || environmentMinify === true
      || hookEnabledMinify
    ) {
      return config
    }

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

      return mergeEnvironmentConfig(config, {
        output: {
          minify: minifyConfig,
        },
      })
    }

    return config
  }

  api.modifyEnvironmentConfig({ order: 'pre', handler })
}
