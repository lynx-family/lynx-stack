// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { CSSLoaderOptions, RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import type {
  CssExtractRspackPluginOptions,
  CssExtractWebpackPluginOptions,
} from '@lynx-js/css-extract-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

const CSS_LAYER = 'css-layer'

export function applyCSS(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const {
    enableRemoveCSSScope,
    enableCSSSelector,
    enableCSSInvalidation,
    targetSdkVersion,
  } = options

  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig(config, {
      // This has following effects:
      // - disables `style-loader`
      // - enables CssExtractRspackPlugin
      // - disables `experiment.css`(which is all we need)
      // See: https://rsbuild.dev/config/output/inject-styles
      output: { injectStyles: false },
    })
  })

  api.modifyBundlerChain(
    async function handler(chain, { CHAIN_ID }) {
      const { CssExtractRspackPlugin, CssExtractWebpackPlugin } = await import(
        '@lynx-js/css-extract-webpack-plugin'
      )
      const CssExtractPlugin = api.context.bundlerType === 'rspack'
        ? CssExtractRspackPlugin
        : CssExtractWebpackPlugin
      const cssRules = [
        CHAIN_ID.RULE.CSS,
        CHAIN_ID.RULE.SASS,
        CHAIN_ID.RULE.LESS,
        CHAIN_ID.RULE.STYLUS,
      ] as const

      cssRules
        // Rsbuild 0.7.0 removed sass and less from builtin plugins
        .filter(rule => chain.module.rules.has(rule))
        .forEach(ruleName => {
          const rule = chain.module.rule(ruleName)

          removeLightningCSS(rule)

          // Replace the CssExtractRspackPlugin.loader with ours.
          // This is for scoped CSS.
          rule
            .use(CHAIN_ID.USE.MINI_CSS_EXTRACT)
            .loader(CssExtractPlugin.loader)
            .end()
            .use(ruleName)
            .tap(options =>
              normalizeCssLoaderOptions(
                options as CSSLoaderOptions,
                true,
              )
            )

          chain.module.rule(CSS_LAYER)
            .test(rule.get('test') as Rspack.RuleSetCondition)
            .layer(CSS_LAYER)
        })

      const inlineCSSRules = [
        CHAIN_ID.RULE.CSS_INLINE,
        CHAIN_ID.RULE.SASS_INLINE,
        CHAIN_ID.RULE.LESS_INLINE,
        CHAIN_ID.RULE.STYLUS_INLINE,
      ] as const

      inlineCSSRules
        // Rsbuild 0.7.0 removed sass and less from builtin plugins
        // Rsbuild 1.3.0 add *_INLINE rules
        .filter(rule => rule && chain.module.rules.has(rule))
        .forEach(ruleName => {
          const rule = chain.module.rule(ruleName)
          removeLightningCSS(rule)
        })

      function removeLightningCSS(rule: ReturnType<typeof chain.module.rule>) {
        if (
          // Webpack does not have lightningcss-loader
          rule.uses.has(CHAIN_ID.USE.LIGHTNINGCSS)
        ) {
          rule.uses.delete(CHAIN_ID.USE.LIGHTNINGCSS)
        }
      }

      chain
        .plugin(CHAIN_ID.PLUGIN.MINI_CSS_EXTRACT)
        .tap(([options]) => {
          return [
            {
              ...options,
              enableRemoveCSSScope: enableRemoveCSSScope ?? true,
              enableCSSSelector,
              enableCSSInvalidation,
              targetSdkVersion,
              cssPlugins: [],
            } as CssExtractWebpackPluginOptions | CssExtractRspackPluginOptions,
          ]
        })
        .init((_, args: unknown[]) => {
          return new CssExtractPlugin(
            ...args as [
              options: (
                & CssExtractWebpackPluginOptions
                & CssExtractRspackPluginOptions
              ),
            ],
          )
        })
        .end()
        .end()

      // We add `sideEffects: false` to all Scoped CSS Modules.
      // Since there is no need to emit scoped CSS when the CSS Modules is not used.
      chain
        .module
        .when(
          // - enableRemoveCSSScope === undefined: we will add `?cssId=<hash>` to all CSS Modules
          //   E.g.: `import styles from './foo.modules.css'`
          enableRemoveCSSScope === undefined,
          module =>
            module
              .rule('lynx.css.scoped')
              .test(/\.css$/)
              .resourceQuery({
                and: [
                  /cssId/,
                  // TODO: support ?common
                  // { not: /common/ },
                ],
              })
              .sideEffects(false),
        )
    },
  )
}

// This is copied from https://github.com/web-infra-dev/rsbuild/blob/9f8be2d71ffeb7da969cda36fd9755db2cadaff5/packages/core/src/plugins/css.ts#L42
//
// If the target is not `web` and the modules option of css-loader is enabled,
// we must enable exportOnlyLocals to only exports the modules identifier mappings.
// Otherwise, the compiled CSS code may contain invalid code, such as `new URL`.
// https://github.com/webpack-contrib/css-loader#exportonlylocals
export const normalizeCssLoaderOptions = (
  options: CSSLoaderOptions,
  exportOnlyLocals: boolean,
): CSSLoaderOptions => {
  if (options.modules && exportOnlyLocals) {
    let { modules } = options
    if (modules === true) {
      modules = { exportOnlyLocals: true }
    } else if (typeof modules === 'string') {
      modules = {
        // @ts-expect-error Type 'string' is not assignable to type 'CSSLoaderModulesMode | undefined'.
        mode: modules,
        exportOnlyLocals: true,
      }
    } else {
      // create a new object to avoid modifying the original options
      modules = {
        ...modules,
        exportOnlyLocals: true,
      }
    }

    return {
      ...options,
      modules,
    }
  }

  return options
}
