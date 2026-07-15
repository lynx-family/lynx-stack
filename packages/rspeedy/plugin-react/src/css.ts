// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CSSLoaderOptions, RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import type {
  CssExtractRspackPluginOptions,
} from '@lynx-js/css-extract-webpack-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

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
      // See: https://rsbuild.rs/config/output/inject-styles
      output: { injectStyles: false },
    })
  })

  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  api.modifyBundlerChain(async (chain, { CHAIN_ID }) => {
    const { CssExtractRspackPlugin } = await import(
      '@lynx-js/css-extract-webpack-plugin'
    )
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
        const mainRuleName = ruleName === CHAIN_ID.RULE.CSS
          ? CHAIN_ID.ONE_OF.CSS_MAIN
          : ruleName
        const mainRule = rule.oneOf(mainRuleName)
        const parentRuleEntries = rule.entries() as Rspack.RuleSetRule

        removeLightningCSS(mainRule)

        // Replace the CssExtractRspackPlugin.loader with ours.
        // This is for scoped CSS.
        mainRule
          .issuerLayer(LAYERS.BACKGROUND)
          .use(CHAIN_ID.USE.MINI_CSS_EXTRACT)
          .loader(CssExtractRspackPlugin.loader)
          .end()

        // The Rsbuild default loaders
        //   - CssExtractRspackPlugin.loader
        //   - css-loader
        //   - resolve-url-loader(for sass/less)
        //   - sass-loader/less-loader(for sass/less)
        const uses = mainRule.uses.entries() ?? {}
        const ruleEntries = mainRule.entries() as Rspack.RuleSetRule

        const cssLoader = uses[CHAIN_ID.USE.CSS]
        if (!cssLoader) {
          return
        }
        const cssLoaderRule = cssLoader.entries() as Rspack.RuleSetRule

        // We add an additional rule for background layer.
        // With only the following loaders:
        //   - ignore-css-loader
        //   - css-loader
        //   - resolve-url-loader(for sass/less)
        //   - sass-loader/less-loader(for sass/less)
        // dprint-ignore
        const mainThreadLayerRule = chain
            .module
              .rule(`${ruleName}:${LAYERS.MAIN_THREAD}`)
              .test(parentRuleEntries.test!)
              .merge(ruleEntries)
              .issuerLayer(LAYERS.MAIN_THREAD)

        if (parentRuleEntries.dependency !== undefined) {
          mainThreadLayerRule.merge({
            dependency: parentRuleEntries.dependency,
          })
        }
        // dprint-ignore
        mainThreadLayerRule
            .use(CHAIN_ID.USE.IGNORE_CSS)
              .loader(path.resolve(__dirname, './loaders/ignore-css-loader'))
              .end()
            .uses
              .merge(uses)
              .delete(CHAIN_ID.USE.MINI_CSS_EXTRACT)
              .delete(CHAIN_ID.USE.LIGHTNINGCSS)
              .delete(CHAIN_ID.USE.CSS)
              .end()
            // We replace the css-loader rules with the normalized one
            // to force setting `exportOnlyLocals: true`.
            .use(CHAIN_ID.USE.CSS)
              .after(CHAIN_ID.USE.IGNORE_CSS)
              .merge(cssLoaderRule)
              .options(
                normalizeCssLoaderOptions(
                  cssLoaderRule.options as CSSLoaderOptions,
                  true,
                ),
              )
              .end()
      })

    cssRules
      // Rsbuild 0.7.0 removed sass and less from builtin plugins
      .filter(rule => rule && chain.module.rules.has(rule))
      .forEach(ruleName => {
        const inlineRuleName = ruleName === CHAIN_ID.RULE.CSS
          ? CHAIN_ID.ONE_OF.CSS_INLINE
          : `${ruleName}-inline`
        const inlineRule = chain.module
          .rule(ruleName)
          .oneOf(inlineRuleName)
        removeLightningCSS(inlineRule)
      })

    function removeLightningCSS(rule: {
      uses: {
        has: (id: string) => boolean
        delete: (id: string) => unknown
      }
    }) {
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
        // Route the main-thread entry's CSS next to the entry's other
        // intermediate outputs (`.rspeedy/<entry>/main-thread.css`), matching
        // the `<entry>__main-thread` → `<entry>/main-thread.js` JS mapping.
        const filenameTemplate = (options as { filename?: string }).filename
        const filename = typeof filenameTemplate === 'string'
            && filenameTemplate.includes('[name]/[name].css')
          ? (pathData: Rspack.PathData) => {
            const name = pathData.chunk?.name
            if (typeof name === 'string' && name.endsWith('__main-thread')) {
              return filenameTemplate.replace(
                '[name]/[name].css',
                `${name.slice(0, -'__main-thread'.length)}/main-thread.css`,
              )
            }
            return filenameTemplate
          }
          : filenameTemplate
        return [
          {
            ...options,
            ...(filename === undefined ? {} : { filename }),
            enableRemoveCSSScope: enableRemoveCSSScope ?? true,
            enableCSSSelector,
            enableCSSInvalidation,
            targetSdkVersion,
            cssPlugins: [],
          } as CssExtractRspackPluginOptions,
        ]
      })
      .init((_, args: unknown[]) => {
        return new CssExtractRspackPlugin(
          ...args as [
            options: CssExtractRspackPluginOptions,
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
  })
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
