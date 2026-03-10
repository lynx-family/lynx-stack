// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mergeRsbuildConfig, rspack } from '@rsbuild/core'
import type { RsbuildPluginAPI, Rspack, RspackChain } from '@rsbuild/core'

export function applyShakeBackgroundDataProcessors(
  api: RsbuildPluginAPI,
): void {
  api.modifyBundlerChain(async (chain) => {
    if (chain.optimization.minimizers.has('js')) {
      const jsMinimizer = chain.optimization.minimizers.get(
        'js' as keyof RspackChain.Plugin<
          Rspack.Optimization,
          Rspack.RspackPluginInstance
        >,
      ) as unknown as {
        store: Map<string, [Rspack.SwcJsMinimizerRspackPluginOptions]>
      }
      const SwcJsMinimizerRspackPlugin = rspack.SwcJsMinimizerRspackPlugin
      const args = jsMinimizer.store.get('args')!
      const originalOptions = args[0]

      const backgroundReg = /background(\..+)?\.js$/
      const backgroundOptions = mergeRsbuildConfig(originalOptions, {
        include: [backgroundReg],
        minimizerOptions: {
          compress: {
            pure_funcs: ['lynx.registerDataProcessors'],
          },
        },
      })

      // Exclude background from default minimizer
      chain.optimization.minimizer('js').tap((args: unknown[]) => {
        const options = args[0] as Rspack.SwcJsMinimizerRspackPluginOptions
        options.exclude = [
          ...(Array.isArray(options.exclude)
            ? options.exclude
            : (options.exclude
              ? [options.exclude]
              : [])),
          backgroundReg,
        ]
        return args
      })

      // Add background minimizer
      chain.optimization.minimizer('js-background')
        .use(SwcJsMinimizerRspackPlugin, [backgroundOptions])
    }
  })
}
