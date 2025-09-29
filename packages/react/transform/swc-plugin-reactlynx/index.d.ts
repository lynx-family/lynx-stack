// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface CssScopeVisitorConfig {
  /** @public */
  mode: 'all' | 'none' | 'modules';
  /** @public */
  filename: string;
}

/** @internal */
export interface JsxTransformerConfig {
  /** @internal */
  preserveJsx: boolean;
  /** @internal */
  runtimePkg: string;
  /** @internal */
  jsxImportSource?: string;
  /** @internal */
  filename: string;
  /** @internal */
  target: 'LEPUS' | 'JS' | 'MIXED';
  /** @internal */
  isDynamicComponent?: boolean;
}

/**
 * {@inheritdoc PluginReactLynxOptions.shake}
 * @public
 */
export interface ShakeVisitorConfig {
  /**
   * Package names to identify runtime imports that need to be processed
   *
   * @example
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       shake: {
   *         pkgName: ['@lynx-js/react-runtime']
   *       }
   *     })
   *   ]
   * })
   * ```
   *
   * @remarks
   * Default value: `['@lynx-js/react-runtime']`
   * The provided values will be merged with the default values instead of replacing them.
   * @public
   */
  pkgName: Array<string>;
  /**
   * Properties that should be retained in the component class
   *
   * @example
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       shake: {
   *         retainProp: ['myCustomMethod']
   *       }
   *     })
   *   ]
   * })
   * ```
   *
   * @remarks
   * Default value: `['constructor', 'render', 'getDerivedStateFromProps', 'state', 'defaultDataProcessor', 'dataProcessors', 'contextType', 'defaultProps']`
   * The provided values will be merged with the default values instead of replacing them.
   *
   * @public
   */
  retainProp: Array<string>;
  /**
   * Function names whose parameters should be removed during transformation
   *
   * @example
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginReactLynx({
   *       shake: {
   *         removeCallParams: ['useMyCustomEffect']
   *       }
   *     })
   *   ]
   * })
   * ```
   *
   * @remarks
   * Default value: `['useEffect', 'useLayoutEffect', '__runInJS', 'useLynxGlobalEventListener', 'useImperativeHandle']`
   * The provided values will be merged with the default values instead of replacing them.
   *
   * @public
   */
  removeCallParams: Array<string>;
}

/**
 * {@inheritdoc PluginReactLynxOptions.defineDCE}
 * @public
 */
export interface DefineDceVisitorConfig {
  /**
   * @public
   * Replaces variables in your code with other values or expressions at compile time.
   *
   * @remarks
   * Caveat: differences between `source.define`
   *
   * `defineDCE` happens before transforming `background-only` directives.
   * So it's useful for eliminating code that is only used in the background from main-thread.
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
   *       defineDCE: {
   *         define: {
   *           __FOO__: 'false',
   *           'process.env.PLATFORM': '"lynx"',
   *         },
   *       },
   *     })
   *   ],
   * })
   * ```
   *
   * Then, `__FOO__` and `process.env.PLATFORM` could be used in source code.
   *
   * ```
   * if (process.env.PLATFORM === 'lynx') {
   *   console.log('lynx')
   * }
   *
   * function FooOrBar() {
   *   if (__FOO__) {
   *     return <text>foo</text>
   *   } else {
   *     return <text>bar</text>
   *   }
   * }
   * ```
   */
  define: Record<string, string>;
}

export interface DynamicImportVisitorConfig {
  /** @internal */
  runtimePkg: string;
  /** @internal */
  layer: string;
}

export interface DirectiveDceVisitorConfig {
  /** @internal */
  target: 'LEPUS' | 'JS' | 'MIXED';
}

export interface InjectVisitorConfig {
  inject: Record<
    string,
    ['expr', string] | ['importDefault', string] | ['importStarAs', string] | ['importNamed', string, string]
  >;
}

export interface WorkletVisitorConfig {
  /**
   * @public
   * During the compilation of worklet, when extracting external variable identifiers,
   * global identifiers available in lepus context need to be ignored.
   * In addition to the default lepus global identifier list provided by the compiler,
   * users can customize the global identifier list through this option.
   * This configuration will take effect together with the default lepus global identifier list.
   */
  customGlobalIdentNames?: Array<string>;
  /** @internal */
  filename: string;
  /** @internal */
  target: 'LEPUS' | 'JS' | 'MIXED';
  runtimePkg: string;
}

export interface ReactLynxTransformOptions {
  /**
   * @internal
   * This is used internally to make sure the test output is consistent.
   */
  mode?: 'production' | 'development' | 'test';
  filename?: string;
  cssScope: boolean | CssScopeVisitorConfig;
  snapshot?: boolean | JsxTransformerConfig;
  shake: boolean | ShakeVisitorConfig;
  defineDCE: boolean | DefineDceVisitorConfig;
  directiveDCE: boolean | DirectiveDceVisitorConfig;
  worklet: boolean | WorkletVisitorConfig;
  dynamicImport?: boolean | DynamicImportVisitorConfig;
  /** @internal */
  inject?: boolean | InjectVisitorConfig;
}
