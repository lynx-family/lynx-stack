// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild / rspeedy plugin that integrates Vue 3 with Lynx's dual-thread
 * architecture (Background Thread renderer + Main Thread PAPI executor).
 *
 * @example
 * ```ts
 * // lynx.config.ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginVueLynx()],
 * })
 * ```
 */

import type { RsbuildPlugin } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

import { applyCSS } from './css.js';
import { applyEntry } from './entry.js';
import { LAYERS } from './layers.js';

export { LAYERS };

/**
 * Options for {@link pluginVueLynx}.
 * @public
 */
export interface PluginVueLynxOptions {
  /**
   * Whether to enable Vue's Options API support.
   * Disabling it reduces bundle size.
   * @defaultValue true
   */
  optionsApi?: boolean;

  /**
   * Whether to enable Vue devtools in production builds.
   * @defaultValue false
   */
  prodDevtools?: boolean;

  /**
   * Whether to enable CSS selector support in the Lynx template.
   * When enabled, CSS from Vue `<style>` blocks and imported CSS files
   * will be compiled into the Lynx bundle and applied via class selectors.
   * @defaultValue true
   */
  enableCSSSelector?: boolean;

  /**
   * Whether to place debug info outside the template bundle.
   * Reduces template size in dev builds.
   * @defaultValue true
   */
  debugInfoOutside?: boolean;
}

/**
 * Create rsbuild / rspeedy plugins for Vue-Lynx dual-thread rendering.
 *
 * Returns an array of two plugins:
 * 1. `@rsbuild/plugin-vue` — Vue SFC support (rspack-vue-loader + VueLoaderPlugin)
 * 2. `lynx:vue` — Lynx dual-thread entry splitting, PAPI bootstrap, and CSS handling
 *
 * @public
 */
export function pluginVueLynx(
  options: PluginVueLynxOptions = {},
): RsbuildPlugin[] {
  const {
    optionsApi = true,
    prodDevtools = false,
    enableCSSSelector = true,
    debugInfoOutside = true,
  } = options;

  return [
    // ① Official Vue SFC support (rspack-vue-loader + VueLoaderPlugin)
    pluginVue({
      vueLoaderOptions: {
        experimentalInlineMatchResource: true,
        compilerOptions: {
          // Lynx native tags (view, text, image, etc.) should not be resolved
          // via resolveComponent — treat everything as native.
          isNativeTag: () => true,
          whitespace: 'condense',
          // Disable static hoisting: @vue/compiler-dom's stringifyStatic
          // transform converts runs of 5+ constant-prop siblings into a single
          // HTML string VNode requiring insertStaticContent() in the renderer.
          // Our ShadowElement custom renderer can't parse HTML strings, so we
          // disable hoisting entirely — the standard approach for non-DOM renderers.
          hoistStatic: false,
        },
      },
    }),

    // ② Lynx dual-thread adaptation logic
    {
      name: 'lynx:vue',
      // Must run after pluginVue ('rsbuild:vue') so that our modifyBundlerChain
      // can see the CHAIN_ID.RULE.VUE rule created by pluginVue.
      pre: ['lynx:rsbuild:plugin-api', 'lynx:config', 'rsbuild:vue'],

      setup(api) {
        api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
          return mergeRsbuildConfig(config, {
            source: {
              define: {
                __DEV__: 'process.env.NODE_ENV !== \'production\'',
                __VUE_OPTIONS_API__: optionsApi ? 'true' : 'false',
                __VUE_PROD_DEVTOOLS__: prodDevtools ? 'true' : 'false',
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
              },
            },
            tools: {
              rspack: {
                output: {
                  iife: false,
                },
              },
            },
          });
        });

        api.modifyBundlerChain((chain) => {
          // "vue" → "@lynx-js/vue-runtime" ensures template compiler output
          // imports from the same module instance (singleton shared state)
          chain.resolve.alias.set('vue', '@lynx-js/vue-runtime');
        });

        // NOTE: vue-loader runs on ALL layers (no issuerLayer constraint).
        // On the MT layer, vue-loader processes .vue files into connector code
        // with sub-module imports. The worklet-loader-mt (enforce: 'post')
        // then filters out template/style imports and only follows the script
        // sub-module, ensuring the LEPUS transform sees the same compiled
        // script content as the BG worklet-loader → matching _wkltId hashes.

        applyCSS(api, {
          enableCSSSelector,
          enableCSSInvalidation: enableCSSSelector,
        });
        applyEntry(api, { enableCSSSelector, debugInfoOutside });
      },
    },
  ];
}
