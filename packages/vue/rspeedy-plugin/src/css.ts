// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * CSS extraction pipeline for Vue Lynx.
 *
 * Mirrors the behaviour of `@lynx-js/react-rsbuild-plugin`'s `applyCSS()`:
 *   1. Disables `style-loader` (forces CSS extraction via CssExtractPlugin).
 *   2. Replaces the rsbuild-default CssExtract plugin with
 *      `@lynx-js/css-extract-webpack-plugin` which emits Lynx-compatible CSS.
 *   3. Removes `lightningcss-loader` (Lynx has its own CSS processor).
 *   4. Configures the Main-Thread layer to ignore CSS entirely.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CSSLoaderOptions, RsbuildPluginAPI, Rspack } from '@rsbuild/core';

import type {
  CssExtractRspackPluginOptions,
  CssExtractWebpackPluginOptions,
} from '@lynx-js/css-extract-webpack-plugin';

import { LAYERS } from './layers.js';

export interface ApplyCSSOptions {
  enableCSSSelector: boolean;
  enableCSSInvalidation: boolean;
}

const _dirname = path.dirname(fileURLToPath(import.meta.url));

export function applyCSS(
  api: RsbuildPluginAPI,
  options: ApplyCSSOptions,
): void {
  const { enableCSSSelector, enableCSSInvalidation } = options;

  // ① Force CSS extraction (disable style-loader, enable CssExtractPlugin).
  // Without this, rsbuild injects CSS via JS — useless in Lynx's native env.
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig(config, {
      output: { injectStyles: false },
    });
  });

  // ② Replace the rsbuild-default CSS extraction plugin with the Lynx-aware
  //    one, configure loaders per layer, and remove lightningcss.
  api.modifyBundlerChain(
    async function handler(chain, { CHAIN_ID }) {
      const { CssExtractRspackPlugin, CssExtractWebpackPlugin } = await import(
        '@lynx-js/css-extract-webpack-plugin'
      );
      const CssExtractPlugin = api.context.bundlerType === 'rspack'
        ? CssExtractRspackPlugin
        : CssExtractWebpackPlugin;

      const cssRules = [
        CHAIN_ID.RULE.CSS,
        CHAIN_ID.RULE.SASS,
        CHAIN_ID.RULE.LESS,
        CHAIN_ID.RULE.STYLUS,
      ] as const;

      cssRules
        .filter((rule) => chain.module.rules.has(rule))
        .forEach((ruleName) => {
          const rule = chain.module.rule(ruleName);

          // Remove lightningcss-loader — Lynx processes CSS natively.
          removeLightningCSS(rule, CHAIN_ID);

          // Use the Lynx CssExtract loader for the Background layer.
          rule
            .issuerLayer(LAYERS.BACKGROUND)
            .use(CHAIN_ID.USE.MINI_CSS_EXTRACT)
            .loader(CssExtractPlugin.loader)
            .end();

          // Clone the existing CSS rule chain for the Main-Thread layer.
          // Main-Thread bundles never contain user CSS — only the PAPI
          // bootstrap code.  We replace all loaders with ignore-css + a
          // css-loader configured for `exportOnlyLocals: true`.
          const uses = rule.uses.entries();
          const ruleEntries = rule.entries() as Rspack.RuleSetRule;
          const cssLoaderRule = uses[CHAIN_ID.USE.CSS]?.entries() as
            | Rspack.RuleSetRule
            | undefined;

          chain.module
            .rule(`${ruleName}:${LAYERS.MAIN_THREAD}`)
            .merge(ruleEntries)
            .issuerLayer(LAYERS.MAIN_THREAD)
            .use(CHAIN_ID.USE.IGNORE_CSS)
            .loader(path.resolve(_dirname, './loaders/ignore-css-loader'))
            .end()
            .uses.merge(uses)
            .delete(CHAIN_ID.USE.MINI_CSS_EXTRACT)
            .delete(CHAIN_ID.USE.LIGHTNINGCSS)
            .delete(CHAIN_ID.USE.CSS)
            .end();

          // Re-add css-loader with exportOnlyLocals for main-thread
          if (cssLoaderRule) {
            chain.module
              .rule(`${ruleName}:${LAYERS.MAIN_THREAD}`)
              .use(CHAIN_ID.USE.CSS)
              .after(CHAIN_ID.USE.IGNORE_CSS)
              .merge(cssLoaderRule)
              .options(
                normalizeCssLoaderOptions(
                  cssLoaderRule.options as CSSLoaderOptions,
                  true,
                ),
              )
              .end();
          }
        });

      // Also strip lightningcss from inline CSS rules (Rsbuild ≥1.3.0).
      // These CHAIN_IDs may not exist in older Rsbuild versions, so we
      // check existence dynamically.
      const RULE = CHAIN_ID.RULE as Record<string, string | undefined>;
      const inlineCSSRuleNames = [
        'CSS_INLINE',
        'SASS_INLINE',
        'LESS_INLINE',
        'STYLUS_INLINE',
      ] as const;

      inlineCSSRuleNames
        .map((key) => RULE[key])
        .filter(
          (ruleName): ruleName is string =>
            !!ruleName && chain.module.rules.has(ruleName),
        )
        .forEach((ruleName) => {
          removeLightningCSS(chain.module.rule(ruleName), CHAIN_ID);
        });

      // ③ Replace the CssExtract plugin instance with the Lynx-aware one
      //    and pass through the CSS selector / invalidation options.
      chain
        .plugin(CHAIN_ID.PLUGIN.MINI_CSS_EXTRACT)
        .tap(([pluginOptions]) => {
          return [
            {
              ...pluginOptions,
              enableRemoveCSSScope: true,
              enableCSSSelector,
              enableCSSInvalidation,
              cssPlugins: [],
            } as
              | CssExtractWebpackPluginOptions
              | CssExtractRspackPluginOptions,
          ];
        })
        .init((_, args: unknown[]) => {
          return new CssExtractPlugin(
            ...(args as [
              options:
                & CssExtractWebpackPluginOptions
                & CssExtractRspackPluginOptions,
            ]),
          );
        })
        .end()
        .end();

      function removeLightningCSS(
        rule: ReturnType<typeof chain.module.rule>,
        ids: typeof CHAIN_ID,
      ): void {
        if (rule.uses.has(ids.USE.LIGHTNINGCSS)) {
          rule.uses.delete(ids.USE.LIGHTNINGCSS);
        }
      }
    },
  );
}

/**
 * Force `exportOnlyLocals: true` on the css-loader modules config.
 * Copied from rsbuild internals — required when the target is not `web`
 * and CSS modules are enabled.
 */
const normalizeCssLoaderOptions = (
  options: CSSLoaderOptions,
  exportOnlyLocals: boolean,
): CSSLoaderOptions => {
  if (options.modules && exportOnlyLocals) {
    let { modules } = options;
    if (modules === true) {
      modules = { exportOnlyLocals: true };
    } else if (typeof modules === 'string') {
      modules = {
        mode: modules as 'local',
        exportOnlyLocals: true,
      };
    } else {
      modules = {
        ...modules,
        exportOnlyLocals: true,
      };
    }

    return {
      ...options,
      modules,
    };
  }

  return options;
};
