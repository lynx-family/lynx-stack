// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'
import { applyBackgroundOnly } from './backgroundOnly.js'
import { applyCSS } from './css.js'
import { applyEntry } from './entry.js'
import { applyLazy } from './lazy.js'
import { applyLoaders } from './loaders.js'
import { applySplitChunksRule } from './splitChunks.js'
import { applySWC } from './swc.js'
import { validateConfig } from './validate.js'

/**
 * Options of {@link pluginVueLynx}
 *
 * @public
 */
export interface PluginVueLynxOptions {
  /**
   * The `compat` option controls compatibilities with VueLynx2.0.
   *
   * @remarks
   *
   * These options should only be used for migrating from VueLynx2.0.
   */
  compat?: {
    /**
     * Whether disable runtime warnings about using VueLynx2.0-incompatible APIs.
     *
     * @defaultValue `false`
     */
    disableCompatibilityWarnings?: boolean
  }

  /**
   * When {@link PluginVueLynxOptions.enableCSSInheritance} is enabled, `customCSSInheritanceList` can control which properties are inheritable, not just the default ones.
   *
   * @example
   *
   * By setting `customCSSInheritanceList: ['direction', 'overflow']`, only the `direction` and `overflow` properties are inheritable.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *  plugins: [
   *    pluginVueLynx({
   *      enableCSSInheritance: true,
   *      customCSSInheritanceList: ['direction', 'overflow']
   *    }),
   *  ],
   * }
   * ```
   */
  customCSSInheritanceList?: string[] | undefined

  /**
   * debugInfoOutside controls whether the debug info is placed outside the template.
   *
   * @remarks
   * This is recommended to be set to true to reduce template size.
   *
   * @public
   */
  debugInfoOutside?: boolean

  /**
   * defaultDisplayLinear controls whether the default value of `display` in CSS is `linear`.
   *
   * @remarks
   *
   * If `defaultDisplayLinear === false`, the default `display` would be `flex` instead of `linear`.
   */
  defaultDisplayLinear?: boolean

  /**
   * enableAccessibilityElement set the default value of `accessibility-element` for all `<view />` elements.
   */
  enableAccessibilityElement?: boolean

  /**
   * enableICU enables the Intl API to be enabled globally.
   *
   * If enabled, please double check the compatibility with Lynx Share Context feature to avoid using shared Intl API from other destroyed card.
   *
   * @defaultValue `false`
   */
  enableICU?: boolean

  /**
   * enableCSSInheritance enables the default inheritance properties.
   *
   * @remarks
   *
   * The following properties are inherited by default:
   *
   * - `direction`
   *
   * - `color`
   *
   * - `font-family`
   *
   * - `font-size`
   *
   * - `font-style`
   *
   * - `font-weight`
   *
   * - `letter-spacing`
   *
   * - `line-height`
   *
   * - `line-spacing`
   *
   * - `text-align`
   *
   * - `text-decoration`
   *
   * - `text-shadow`
   *
   * It is recommended to use with {@link PluginVueLynxOptions.customCSSInheritanceList} to avoid performance issues.
   */
  enableCSSInheritance?: boolean

  /**
   * CSS Invalidation refers to the process of determining which elements need to have their styles recalculated when the DOM is updated.
   *
   * @example
   *
   * If a descendant selector `.a .b` is defined in a CSS file, then when an element's class changes to `.a`, all nodes in its subtree with the className `.b` need to have their styles recalculated.
   *
   * @remarks
   *
   * When using combinator to determine the styles of various elements (including descendants, adjacent siblings, etc.), it is recommended to enable this feature. Otherwise, only the initial class setting can match the corresponding combinator, and subsequent updates will not recalculate the related styles.
   *
   * We find that collecting invalidation nodes and updating them is a relatively time-consuming process.
   * If there is no such usage and better style matching performance is needed, this feature can be selectively disabled.
   */
  enableCSSInvalidation?: boolean

  /**
   * enableCSSSelector controls whether enabling the new CSS implementation.
   *
   * @public
   */
  enableCSSSelector?: boolean

  /**
   * enableNewGesture enables the new gesture system.
   *
   * @defaultValue `false`
   */
  enableNewGesture?: boolean

  /**
   * enableParallelElement enables Threaded Element Resolution.
   *
   * @defaultValue `true`
   *
   * @public
   */
  enableParallelElement?: boolean

  /**
   * enableRemoveCSSScope controls whether CSS is restrict to use in the component scope.
   *
   * `true`: All CSS files are treated as global CSS.
   *
   * `false`: All CSS files are treated as scoped CSS, and only take effect in the component that explicitly imports it.
   *
   * `undefined`: Only use scoped CSS for CSS Modules, and treat other CSS files as global CSS. Scoped CSS is faster than global CSS, thus you can use CSS Modules to speedy up your CSS if there are performance issues.
   *
   * @defaultValue `true`
   *
   * @public
   */
  enableRemoveCSSScope?: boolean | undefined

  /**
   * This flag controls when MainThread (Lepus) transfers control to Background after the first screen
   *
   * This flag has two options:
   *
   * `"immediately"`: Transfer immediately
   *
   * `"jsReady"`: Transfer when background (JS Runtime) is ready
   *
   * After handing over control, MainThread (Lepus) runtime can no longer respond to data updates,
   * and data updates will be forwarded to background (JS Runtime) and processed __asynchronously__
   *
   * @defaultValue "immediately"
   */
  firstScreenSyncTiming?: 'immediately' | 'jsReady'

  /**
   * pipelineSchedulerConfig represents pipeline scheduling strategies, including {@link PluginVueLynxOptions.enableParallelElement} and list batch-rendering.
   *
   * @remarks
   *
   * Preallocate 64 bit unsigned integer for pipeline scheduler config.
   *
   * -  0 ~ 7 bit: Reserved for parsing binary bundle into C++ bundle.
   *
   * -  8 ~ 15 bit: Reserved for MTS Render.
   *
   * -  16 ~ 23 bit: Reserved for resolve stage in Pixel Pipeline.
   *
   * -  24 ~ 31 bit: Reserved for layout stage in Pixel Pipeline.
   *
   * -  32 ~ 39 bit: Reserved for execute UI OP stage in Pixel Pipeline.
   *
   * -  40 ~ 47 bit: Reserved for paint stage in Pixel Pipeline.
   *
   * -  48 ~ 63 bit: Flexible bits for extensibility.
   *
   * @defaultValue `0x00010000`
   */
  pipelineSchedulerConfig?: number

  /**
   * removeDescendantSelectorScope is used to remove the scope of descendant selectors.
   */
  removeDescendantSelectorScope?: boolean

  /**
   * `engineVersion` specifies the minimum Lynx Engine version required for an App bundle to function properly.
   *
   * @public
   */
  engineVersion?: string

  /**
   * targetSdkVersion is used to specify the minimal Lynx Engine version that a App bundle can run on.
   *
   * @public
   * @deprecated `targetSdkVersion` is now an alias of {@link PluginVueLynxOptions.engineVersion}. Use {@link PluginVueLynxOptions.engineVersion} instead.
   */
  targetSdkVersion?: string

  /**
   * Generate standalone lazy bundle.
   *
   * @alpha
   */
  experimental_isLazyBundle?: boolean
}

/**
 * A rsbuild plugin that integrates with VueLynx.
 *
 * @remarks
 *
 * This plugin provides the following features:
 *
 * - Split Vue's `<template>` code to main thread and `<script>` code to background thread
 * - Extract style code to main thread and inject CSS extract plugin
 * - Apply runtime code like hot module reload
 * - Support for Vue's Single File Components (SFC)
 *
 * @example
 *
 * ```js
 * import { defineConfig } from '@lynx-js/rspeedy'
 * import { pluginVueLynx } from '@lynx-js/rspeedy-plugin-vue'
 *
 * export default defineConfig({
 *   plugins: [
 *     pluginVueLynx(),
 *   ],
 * })
 * ```
 *
 * @public
 */
export function pluginVueLynx(
  userOptions?: PluginVueLynxOptions,
): RsbuildPlugin {
  const options: Required<PluginVueLynxOptions> = {
    compat: userOptions?.compat ?? {},
    customCSSInheritanceList: userOptions?.customCSSInheritanceList
      ?? undefined,
    debugInfoOutside: userOptions?.debugInfoOutside ?? true,
    defaultDisplayLinear: userOptions?.defaultDisplayLinear ?? true,
    enableAccessibilityElement: userOptions?.enableAccessibilityElement
      ?? false,
    enableICU: userOptions?.enableICU ?? false,
    enableCSSInheritance: userOptions?.enableCSSInheritance ?? false,
    enableCSSInvalidation: userOptions?.enableCSSInvalidation ?? true,
    enableCSSSelector: userOptions?.enableCSSSelector ?? true,
    enableNewGesture: userOptions?.enableNewGesture ?? false,
    enableParallelElement: userOptions?.enableParallelElement ?? true,
    enableRemoveCSSScope: userOptions?.enableRemoveCSSScope ?? true,
    firstScreenSyncTiming: userOptions?.firstScreenSyncTiming ?? 'immediately',
    pipelineSchedulerConfig: userOptions?.pipelineSchedulerConfig ?? 0x00010000,
    removeDescendantSelectorScope: userOptions?.removeDescendantSelectorScope
      ?? false,
    engineVersion: userOptions?.engineVersion ?? '',
    targetSdkVersion: userOptions?.targetSdkVersion
      ?? userOptions?.engineVersion ?? '',
    experimental_isLazyBundle: userOptions?.experimental_isLazyBundle ?? false,
  }

  return {
    name: 'rspeedy:plugin-vue',
    pre: ['lynx:rsbuild:plugin-api'],

    setup(api) {
      // Validate the configuration
      validateConfig(options)

      // Apply the entry configuration
      applyEntry(api, options)

      // Apply the CSS configuration
      applyCSS(api, options)

      // Apply the loaders configuration
      applyLoaders(api, options)

      // Apply the SWC configuration
      applySWC(api)

      // Apply the split chunks rule
      applySplitChunksRule(api)

      // Apply the alias configuration
      // applyAlias(api)

      // Apply the background only configuration
      applyBackgroundOnly(api)

      // Apply the lazy configuration
      applyLazy(api, options)
    },
  }
}
