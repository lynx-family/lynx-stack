// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

type CacheGroups = Rspack.Configuration extends {
  optimization?: {
    splitChunks?:
      | {
        cacheGroups?: infer P
      }
      | false
      | undefined
  } | undefined
} ? P
  : never

type SplitChunks = Rspack.Configuration extends {
  optimization?: {
    splitChunks?: infer P
  } | undefined
} ? P
  : never

const isPlainObject = (obj: unknown): obj is Record<string, unknown> =>
  obj !== null
  && typeof obj === 'object'
  && Object.prototype.toString.call(obj) === '[object Object]'

export const applySplitChunksRule = (
  api: RsbuildPluginAPI,
): void => {
  // Defaults to `all-in-one`.
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    const userConfig = api.getRsbuildConfig('original')
    if (!userConfig.performance?.chunkSplit?.strategy) {
      return mergeRsbuildConfig(config, {
        performance: {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
      })
    }
    return config
  })

  api.modifyBundlerChain((chain, { environment }) => {
    const { config } = environment
    if (config.performance.chunkSplit.strategy !== 'split-by-experience') {
      return
    }

    const currentConfig = chain.optimization.splitChunks.values() as Exclude<
      SplitChunks,
      false
    >
    if (!isPlainObject(currentConfig)) {
      return
    }

    const extraGroups: CacheGroups = {}

    extraGroups['preact'] = {
      name: 'lib-preact',
      test:
        /node_modules[\\/](.*?[\\/])?(?:preact|preact[\\/]compat|preact[\\/]hooks|preact[\\/]jsx-runtime)[\\/]/,
      priority: 0,
    }

    chain.optimization.splitChunks({
      ...currentConfig,
      cacheGroups: {
        ...currentConfig.cacheGroups,
        ...extraGroups,
      },
    })
  })

  api.modifyRspackConfig((rspackConfig, { environment }) => {
    if (environment.name !== 'lynx') {
      return rspackConfig
    }

    if (!rspackConfig.optimization) {
      return rspackConfig
    }

    if (!rspackConfig.optimization.splitChunks) {
      return rspackConfig
    }

    rspackConfig.optimization.splitChunks.chunks = function chunks(chunk) {
      // TODO: support `splitChunks.chunks: 'async'`
      // We don't want main thread to be split
      return !chunk.name?.includes('__main-thread')
    }
    return rspackConfig
  })
}
