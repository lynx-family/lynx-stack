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

import type { RsbuildPlugin } from '@rsbuild/core'

import { applyEntry } from './entry.js'
import { LAYERS } from './layers.js'

export { LAYERS }

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
  optionsApi?: boolean

  /**
   * Whether to enable Vue devtools in production builds.
   * @defaultValue false
   */
  prodDevtools?: boolean
}

/**
 * Create a rsbuild / rspeedy plugin for Vue-Lynx dual-thread rendering.
 * @public
 */
export function pluginVueLynx(
  options: PluginVueLynxOptions = {},
): RsbuildPlugin {
  const { optionsApi = true, prodDevtools = false } = options

  return {
    name: 'lynx:vue',
    pre: ['lynx:rsbuild:plugin-api', 'lynx:config'],

    setup(api) {
      // Inject Vue build-time macros via DefinePlugin
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig, isDev }) => {
        return mergeRsbuildConfig(config, {
          source: {
            define: {
              __DEV__: isDev ? 'true' : 'false',
              __VUE_OPTIONS_API__: optionsApi ? 'true' : 'false',
              __VUE_PROD_DEVTOOLS__: prodDevtools ? 'true' : 'false',
              __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
            },
          },
          tools: {
            rspack: {
              output: {
                // Disable IIFE so main-thread.js works in Lepus scope
                iife: false,
              },
            },
          },
        })
      })

      // Set up dual-bundle entry splitting and Lynx plugins
      applyEntry(api)
    },
  }
}
