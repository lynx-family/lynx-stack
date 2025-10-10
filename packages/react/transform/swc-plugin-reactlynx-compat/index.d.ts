// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc CompatVisitorConfig.addComponentElement}
 * @public
 */
export interface AddComponentElementConfig {
  /**
   * @public
   * Whether to only add component element during compilation
   *
   * @example
   *
   * Note that this only take effects on `Component` imported from {@link CompatVisitorConfig.oldRuntimePkg}.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         addComponentElement: { compilerOnly: true }
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  compilerOnly: boolean;
}

export interface DarkModeConfig {
  /**
   * @public
   * Theme expression to be used for dark mode
   */
  themeExpr: string;
}

/**
 * {@inheritdoc CompatVisitorConfig.addComponentElement}
 * @public
 */

/**
 * {@inheritdoc PluginReactLynxOptions.compat}
 * @public
 */
export interface CompatVisitorConfig {
  /** @internal */
  target: 'LEPUS' | 'JS' | 'MIXED';
  /**
   * @public
   * Specifies the list of component package names that need compatibility processing
   *
   * @remarks
   * Default value: `['@lynx-js/react-components']`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         componentsPkg: ['@my-org/components', '@legacy/ui-kit']
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  componentsPkg: Array<string>;
  /**
   * @public
   * Specifies the list of old runtime package names that need compatibility processing
   *
   * @remarks
   * Default value: `['@lynx-js/react-runtime']`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         oldRuntimePkg: ['@my-org/runtime', '@legacy/runtime']
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  oldRuntimePkg: Array<string>;
  /**
   * @public
   * Specifies the new runtime package name
   *
   * @remarks
   * Default value: `'@lynx-js/react'`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         newRuntimePkg: '@my-org/react'
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  newRuntimePkg: string;
  /**
   * @public
   * Specifies additional component attributes list, these attributes will be passed to the wrapped `<view>` instead of the component.
   *
   * @remarks
   * This only takes effect when {@link CompatVisitorConfig.addComponentElement} is enabled.
   *
   * Default value: `[]`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         additionalComponentAttributes: ['custom-attr', 'data-special']
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  additionalComponentAttributes: Array<string>;
  /**
   * @public
   * Controls whether to add wrapper elements for components
   *
   * @remarks
   * Default value: `false`
   *
   * @example
   *
   * Add a `<view>` wrapper element for all components during runtime.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         addComponentElement: true
   *       },
   *     })
   *   ],
   * })
   * ```
   *
   * @example
   *
   * Only add component element during compilation.
   * Note that this only take effects on `Component` imported from {@link CompatVisitorConfig.oldRuntimePkg}.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         addComponentElement: { compilerOnly: true }
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  addComponentElement: boolean | AddComponentElementConfig;
  /**
   * @public
   * Whether to simplify constructor calls like ReactLynx 2
   *
   * @deprecated
   * Using `simplifyCtorLikeReactLynx2` is not recommended as it introduces implicit behaviors that can:
   *
   * - Make code harder to understand and maintain
   *
   * - Create hidden dependencies between components
   *
   * - Complicate debugging and testing processes
   *
   * Instead, use `background-only` on class methods for explicit and maintainable behavior
   *
   * @remarks
   * Default value: `false`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         simplifyCtorLikeReactLynx2: true
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  simplifyCtorLikeReactLynx2: boolean;
  /**
   * @public
   * Regular expression used to remove component attributes
   *
   * @deprecated It's recommended to use `background-only`.
   *
   * If your code depends on this switch, when distributing it to other projects through npm packages or other means, you'll also need to enable this switch. This will lead to the proliferation of switches, which is not conducive to code reuse between different projects.
   *
   * @remarks
   * Default value: `None`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         removeComponentAttrRegex: '^data-test-'
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  removeComponentAttrRegex?: string;
  /**
   * @public
   * Whether to disable deprecated warnings
   *
   * @remarks
   * Default value: `false`
   *
   * @example
   *
   * Disable all the `DEPRECATED:` warnings.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         disableDeprecatedWarning: true
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  disableDeprecatedWarning: boolean;
  /**
   * @public
   * @deprecated
   * Dark mode configuration
   *
   * @remarks
   * Default value: `None`
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       compat: {
   *         darkMode: true
   *       },
   *     })
   *   ],
   * })
   * ```
   */
  darkMode?: boolean | DarkModeConfig;
}
