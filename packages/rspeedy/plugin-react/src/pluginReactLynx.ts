// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that integrates with ReactLynx.
 */

import { createRequire } from 'node:module'

import type { RsbuildPlugin } from '@rsbuild/core'

import type {
  CompatVisitorConfig,
  DefineDceVisitorConfig,
  JsxTransformerConfig,
  ShakeVisitorConfig,
} from '@lynx-js/react/transform'
import type { ExtractStrConfig } from '@lynx-js/react-webpack-plugin'
import type { ExposedAPI } from '@lynx-js/rspeedy'

import { applyAlias } from './alias.js'
import { applyBackgroundOnly } from './backgroundOnly.js'
import { applyCSS } from './css.js'
import { applyEntry } from './entry.js'
import { applyGenerator } from './generator.js'
import { applyLazy } from './lazy.js'
import { applyLoaders } from './loaders.js'
import { applyRefresh } from './refresh.js'
import { applySplitChunksRule } from './splitChunks.js'
import { applySWC } from './swc.js'
import { validateConfig } from './validate.js'

/**
 * Options of {@link pluginReactLynx}
 *
 * @public
 */
export interface PluginReactLynxOptions {
  /**
   * The `compat` option controls compatibilities with ReactLynx2.0.
   *
   * @remarks
   *
   * These options should only be used for migrating from ReactLynx2.0.
   */
  compat?:
    | Partial<CompatVisitorConfig> & {
      /**
       * Whether disable runtime warnings about using ReactLynx2.0-incompatible `SelectorQuery` APIs.
       *
       * @example
       * Using the following APIs will have a runtime warning by default:
       *
       * ```ts
       * this.createSelectorQuery()
       * this.getElementById()
       * this.getNodeRef()
       * this.getNodeRefFromRoot()
       * ```
       *
       * @defaultValue `false`
       */
      disableCreateSelectorQueryIncompatibleWarning?: boolean
    }
    | undefined

  /**
   * When {@link PluginReactLynxOptions.enableCSSInheritance} is enabled, `customCSSInheritanceList` can control which properties are inheritable, not just the default ones.
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
   *    pluginReactLynx({
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
   * It is recommended to use with {@link PluginReactLynxOptions.customCSSInheritanceList} to avoid performance issues.
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
   * `enableSSR` enable Lynx SSR feature for this build.
   *
   * @defaultValue `false`
   *
   * @public
   */
  enableSSR?: boolean

  /**
   * The `jsx` option controls how JSX is transformed.
   */
  jsx?: Partial<JsxTransformerConfig> | undefined

  /**
   * Composite configuration representing pipeline scheduling strategies, including {@link PluginReactLynxOptions.enableParallelElement} and list batch-rendering. All newly introduced scheduling strategies will be managed by this uint64 configuration.
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
   * How main-thread code will be shaken.
   */
  shake?: Partial<ShakeVisitorConfig> | undefined

  /**
   * Like `define` in various bundlers, but this one happens at transform time, and a DCE pass will be performed.
   */
  defineDCE?: Partial<DefineDceVisitorConfig> | undefined

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
   * @deprecated `targetSdkVersion` is now an alias of {@link PluginReactLynxOptions.engineVersion}. Use {@link PluginReactLynxOptions.engineVersion} instead.
   */
  targetSdkVersion?: string

  /**
   * Merge same string literals in JS and Lepus to reduce output bundle size.
   * Set to `false` to disable.
   *
   * @defaultValue false
   */
  extractStr?: Partial<ExtractStrConfig> | boolean

  /**
   * Generate standalone lazy bundle.
   *
   * @alpha
   */
  experimental_isLazyBundle?: boolean
}

/**
 * Create a rsbuild plugin for ReactLynx.
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 * export default {
 *   plugins: [pluginReactLynx()]
 * }
 * ```
 *
 * @public
 */
export function pluginReactLynx(
  userOptions?: PluginReactLynxOptions,
): RsbuildPlugin {
  validateConfig(userOptions)

  const engineVersion = userOptions?.engineVersion
    ?? userOptions?.targetSdkVersion ?? '3.2'

  const defaultOptions: Required<PluginReactLynxOptions> = {
    compat: undefined,
    customCSSInheritanceList: undefined,
    debugInfoOutside: true,
    defaultDisplayLinear: true,
    enableAccessibilityElement: false,
    enableICU: false,
    enableCSSInheritance: false,
    enableCSSInvalidation: true,
    enableCSSSelector: true,
    enableNewGesture: false,
    enableParallelElement: true,
    enableRemoveCSSScope: true,
    firstScreenSyncTiming: 'immediately',
    enableSSR: false,
    jsx: undefined,
    pipelineSchedulerConfig: 0x00010000,
    removeDescendantSelectorScope: true,
    shake: undefined,
    defineDCE: undefined,

    // The following two default values are useless, since they will be overridden by `engineVersion`
    targetSdkVersion: '',
    engineVersion: '',
    extractStr: false,

    experimental_isLazyBundle: false,
  }
  const resolvedOptions = Object.assign(defaultOptions, userOptions, {
    // Use `engineVersion` to override the default values
    targetSdkVersion: engineVersion,
    engineVersion,
  })

  return {
    name: 'lynx:react',
    pre: ['lynx:rsbuild:plugin-api'],
    async setup(api) {
      await applyAlias(api, resolvedOptions.experimental_isLazyBundle)
      applyCSS(api, resolvedOptions)
      applyEntry(api, resolvedOptions)
      applyBackgroundOnly(api)
      applyGenerator(api)
      applyLoaders(api, resolvedOptions)
      applyRefresh(api)
      applySplitChunksRule(api)
      applySWC(api)

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const userConfig = api.getRsbuildConfig('original')
        if (typeof userConfig.source?.include === 'undefined') {
          return mergeRsbuildConfig(config, {
            source: {
              include: [
                /\.(?:js|mjs|cjs)$/,
              ],
            },
          })
        }

        return config
      })

      if (resolvedOptions.experimental_isLazyBundle) {
        applyLazy(api)
      }

      const rspeedyAPIs = api.useExposed<ExposedAPI>(
        Symbol.for('rspeedy.api'),
      )!

      const require = createRequire(import.meta.url)

      const { version } = require('../package.json') as { version: string }

      rspeedyAPIs.debug(() => {
        const webpackPluginPath = require.resolve(
          '@lynx-js/react-webpack-plugin',
        )
        return `Using @lynx-js/react-webpack-plugin v${version} at ${webpackPluginPath}`
      })
    },
  }
}
