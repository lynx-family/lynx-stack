// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildConfig, RsbuildPlugin, Rspack } from '@rsbuild/core'

import { mergeRspeedyConfig } from '../config/mergeRspeedyConfig.js'
import type { Minify } from '../config/output/minify.js'
import { debug } from '../debug.js'

const MAIN_THREAD_JS_PATTERN = /.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$/
const BACKGROUND_JS_PATTERN = /.*background(?:\.[A-Fa-f0-9]*)?\.js$/

function mergeJsOptions(
  baseOptions: NonNullable<Minify['jsOptions']>,
  threadOptions: NonNullable<Minify['jsOptions']> | undefined,
): NonNullable<Minify['jsOptions']> {
  const merged = mergeRspeedyConfig(
    { output: { minify: { jsOptions: baseOptions } } },
    { output: { minify: { jsOptions: threadOptions } } },
  )
  return (merged.output?.minify as Minify | undefined)?.jsOptions ?? {}
}

export function pluginMinify(options?: Minify | boolean): RsbuildPlugin {
  const defaultJsOptions = Object.freeze<NonNullable<Minify['jsOptions']>>({
    minimizerOptions: {
      compress: {
        /**
         * the module wrapper iife need to be kept to provide the return value
         * for the module loader in lynx_core.js
         */
        negate_iife: false,
        join_vars: false,
        ecma: 2015,
        inline: 2,
        comparisons: false,

        toplevel: true,

        // Allow return in module wrapper
        side_effects: false,
      },
      format: {
        keep_quoted_props: true,
        comments: false,
      },
      mangle: {
        toplevel: true,
      },
    },
  })
  const defaultConfig = Object.freeze<RsbuildConfig>({
    output: {
      minify: {
        js: true,
        jsOptions: defaultJsOptions,
        css: true,
        cssOptions: {
          minimizerOptions: {
            // Disable the default targets by passing an empty string.
            targets: '',
            include: {
              // Lynx does not support nesting, so we enable it here.
              // https://lightningcss.dev/transpilation.html#nesting
              nesting: true,

              // Lynx does not support double position gradients, so we enable it here.
              // https://lightningcss.dev/transpilation.html#double-position-gradients
              doublePositionGradients: true,

              // Lynx does not support space separated color notation, so we enable it here.
              // https://lightningcss.dev/transpilation.html#space-separated-color-notation
              spaceSeparatedColorNotation: true,
            },
            exclude: {
              // Lynx does not support vendor prefixes, so we exclude it here.
              // https://lightningcss.dev/transpilation.html#vendor-prefixing
              vendorPrefixes: true,
              // Lynx does not support logical properties(`dir`, `lang`, `is`), so we exclude it here.
              // https://lightningcss.dev/transpilation.html#logical-properties
              logicalProperties: true,

              // Lynx does support hex alpha colors, so we exclude it here.
              // https://lightningcss.dev/transpilation.html#hex-alpha-colors
              hexAlphaColors: true,
            },
          },
        },
      },
    },
  })

  return {
    name: 'lynx:rsbuild:minify',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        // Disable minification
        if (options === false) {
          debug(`minification disabled`)
          return mergeRsbuildConfig(config, {
            output: { minify: false },
          })
        }

        const configs = [config, defaultConfig]

        if (options !== true && options !== undefined) {
          debug(`merging minification options`)
          configs.push({
            output: {
              minify: options,
            },
          } as RsbuildConfig)
        }

        return mergeRsbuildConfig(...configs)
      })

      api.modifyBundlerChain((chain, { rspack, CHAIN_ID }) => {
        const currentConfig = api.getRsbuildConfig('normalized')
        const minify = currentConfig.output?.minify as
          | Minify
          | boolean
          | undefined

        // Disable minification
        if (
          typeof minify !== 'object' || minify === null || minify.js === false
        ) {
          return
        }

        // No thread options, skip
        if (
          minify.mainThreadOptions === undefined
          && minify.backgroundOptions === undefined
        ) {
          return
        }

        const jsOptions = minify.jsOptions ?? {}

        // 1. Modify the default swc minimizer added by rsbuild
        if (chain.optimization.minimizers.has(CHAIN_ID.MINIMIZER.JS)) {
          chain.optimization.minimizer(CHAIN_ID.MINIMIZER.JS).tap(
            (args: Rspack.SwcJsMinimizerRspackPluginOptions[]) => {
              const defaultOptions = args[0] ?? {}
              const threadExclude = [
                MAIN_THREAD_JS_PATTERN,
                BACKGROUND_JS_PATTERN,
              ]
              defaultOptions.exclude = defaultOptions.exclude
                ? (Array.isArray(defaultOptions.exclude)
                  ? [...defaultOptions.exclude, ...threadExclude]
                  : [defaultOptions.exclude, ...threadExclude])
                : threadExclude
              return [defaultOptions]
            },
          )
        }

        // 2. Main thread minimizer
        const mainThreadOptions = mergeJsOptions(
          jsOptions,
          minify.mainThreadOptions,
        )
        const mtInclude = [MAIN_THREAD_JS_PATTERN]
        mainThreadOptions.include = mainThreadOptions.include
          ? (Array.isArray(mainThreadOptions.include)
            ? [...mainThreadOptions.include, ...mtInclude]
            : [mainThreadOptions.include, ...mtInclude])
          : mtInclude

        chain.optimization
          .minimizer('js-main-thread')
          .use(rspack.SwcJsMinimizerRspackPlugin, [mainThreadOptions])
          .end()

        // 3. Background thread minimizer
        const backgroundOptions = mergeJsOptions(
          jsOptions,
          minify.backgroundOptions,
        )
        const bgInclude = [BACKGROUND_JS_PATTERN]
        backgroundOptions.include = backgroundOptions.include
          ? (Array.isArray(backgroundOptions.include)
            ? [...backgroundOptions.include, ...bgInclude]
            : [backgroundOptions.include, ...bgInclude])
          : bgInclude

        chain.optimization
          .minimizer('js-background')
          .use(rspack.SwcJsMinimizerRspackPlugin, [backgroundOptions])
          .end()
      })
    },
  }
}
