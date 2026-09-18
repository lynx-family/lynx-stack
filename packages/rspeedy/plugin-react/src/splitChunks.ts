// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildConfig, RsbuildPluginAPI, Rspack } from '@rsbuild/core'

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

// A value set on the environment wins over the same value set at the root,
// which is how Rsbuild merges the two.
export function getUserSplitChunks(
  config: RsbuildConfig,
  environment: string,
): {
  splitChunks: RsbuildConfig['splitChunks']
  chunkSplitStrategy: string | undefined
} {
  const scoped = config.environments?.[environment]
  return {
    splitChunks: scoped?.splitChunks ?? config.splitChunks,
    chunkSplitStrategy: scoped?.performance?.chunkSplit?.strategy
      ?? config.performance?.chunkSplit?.strategy,
  }
}

export const applySplitChunksRule: (
  api: RsbuildPluginAPI,
) => void = (api): void => {
  // Defaults to `all-in-one`.
  api.modifyEnvironmentConfig((config, { name, mergeEnvironmentConfig }) => {
    const { splitChunks, chunkSplitStrategy } = getUserSplitChunks(
      api.getRsbuildConfig('original'),
      name,
    )
    if (
      splitChunks === undefined
      && (chunkSplitStrategy === 'all-in-one' || !chunkSplitStrategy)
    ) {
      return mergeEnvironmentConfig(config, {
        splitChunks: false,
      })
    }
    return config
  })

  api.modifyBundlerChain((chain, { environment }) => {
    const { config } = environment
    const { splitChunks, chunkSplitStrategy } = getUserSplitChunks(
      api.getRsbuildConfig('original'),
      environment.name,
    )
    const isSplitByExperience = splitChunks === undefined
      ? chunkSplitStrategy === 'split-by-experience'
      : (isPlainObject(config.splitChunks)
        && config.splitChunks.preset === 'default')

    if (!isSplitByExperience) {
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
        /node_modules[\\/](.*?[\\/])?(?:(?:internal-)?preact|(?:internal-)?preact[\\/]compat|(?:internal-)?preact[\\/]hooks|(?:internal-)?preact[\\/]jsx-runtime)[\\/]/,
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

  api.modifyRspackConfig((rspackConfig) => {
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
