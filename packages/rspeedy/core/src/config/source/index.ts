// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

import type { Decorators } from './decorators.js'
import type { Entry } from './entry.js'
import type { TransformImport } from './transformImport.js'

/**
 * {@inheritdoc Config.source}
 *
 * @public
 */
export interface Source {
  // TODO(doc): update alias docs after supporting tsconfig-path-plugin
  // TODO(tsconfig): update alias docs after supporting tsconfig-path-plugin
  /**
   * Create aliases to `import` or `require` certain modules more easily.
   *
   * @example
   *
   * A trailing `$` can also be added to the given object's keys to signify an exact match:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     alias: {
   *       xyz$: 'path/to/file.js',
   *     },
   *   },
   * })
   * ```
   *
   * which would yield these results:
   *
   * ```js
   * import Test1 from 'xyz'; // Exact match, so path/to/file.js is resolved and imported
   * import Test2 from 'xyz/file.js'; // Not an exact match, normal resolution takes place
   * ```
   *
   * @example
   *
   * `source.alias` is useful to control how a npm package is resolved.
   *
   * - Change `react` to `@lynx-js/react`:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { createRequire } from 'module'
   * const require = createRequire(import.meta.url)
   * export default defineConfig({
   *   source: {
   *     alias: {
   *       react: require.resolve('@lynx-js/react'),
   *     },
   *   },
   * })
   * ```
   *
   * This allows you to use some third-party libraries that directly uses `react` as dependencies in ReactLynx.
   *
   * - Force using the same version of `dayjs`:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import { createRequire } from 'module'
   * const require = createRequire(import.meta.url)
   * export default defineConfig({
   *   source: {
   *     alias: {
   *       dayjs: require.resolve('dayjs'),
   *     },
   *   },
   * })
   * ```
   *
   * Please note that this is dangerous, since all the `dayjs`(including the dependencies of a dependencies) is resolved to the version in the project.
   * It may cause both compile-time and runtime errors due to version mismatch.
   *
   * @example
   * Setting `source.alias` to `false` will ignore a module.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     alias: {
   *       'ignored-module': false,
   *       './ignored-module': false,
   *     },
   *   },
   * })
   * ```
   */
  alias?: Record<string, string | false | string[]> | undefined

  /**
   * Include additional files that should be treated as static assets. Defaults to be `undefined`.
   *
   * @remarks
   *
   * By default, Rsbuild treats common image, font, audio, and video files as static assets.
   * Through the source.assetsInclude config, you can specify additional file types that should be treated as static assets.
   * These added static assets are processed using the same rules as the built-in supported static assets。
   *
   * The usage of `source.assetsInclude` is consistent with {@link https://rspack.dev/config/module#condition | Condition}
   * in Rspack, which supports passing in strings, regular expressions, arrays of conditions, or logical conditions
   * to match the module path or assets.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     assetsInclude: /\.json5$/,
   *   },
   * })
   * ```
   */
  assetsInclude?: Rspack.RuleSetCondition | undefined

  /**
   * Used to configure the decorators syntax.
   *
   * @remarks
   *
   * See {@link Decorators.version} for more information.
   */
  decorators?: Decorators | undefined

  /**
   * The `define` options is used to define some values or expressions at compile time.
   *
   * @example
   *
   * Using `define` for environment variables.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     define: {
   *       BUILD_VERSION: JSON.stringify(process.env.BUILD_VERSION ?? 'unknown_version'),
   *       'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
   *     },
   *   },
   * })
   * ```
   *
   * Expressions will be replaced with the corresponding code fragments:
   *
   * ```js
   * const version = BUILD_VERSION;
   * if (process.env.NODE_ENV === 'development') {}
   *
   * // ⬇️ Turn into being...
   * const version = "unknown_version";
   * if ("development" === 'development') {}
   * ```
   *
   * @example
   *
   * Using `define` for `typeof`.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     define: {
   *       'typeof window': JSON.stringify("undefined"),
   *     },
   *   },
   * })
   * ```
   *
   * The `typeof` expressions will be replaced with the corresponding code fragments:
   *
   * ```js
   * if (typeof window !== 'undefined') {}
   *
   * // ⬇️ Turn into being...
   * if ("undefined" !== 'undefined') {}
   * ```
   *
   * @example
   *
   * Using `define` with objects.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     define: {
   *       'import.meta': {
   *         foo: JSON.stringify('foo'),
   *         bar: { baz: 0 },
   *       },
   *     },
   *   },
   * })
   * ```
   *
   * Expressions will be replaced with the corresponding code fragments:
   *
   * ```js
   * console.log(import.meta)
   *
   * // ⬇️ Turn into being...
   * console.log({ foo: "foo", bar: { baz: 0 } })
   * ```
   *
   * @remarks
   *
   * - If the value provided is a string, it will be utilized as a code fragment.
   *
   * - If the value provided is an object, all its keys will be defined in the same manner.
   *
   * - If the value isn't a string, it will be stringified, with functions included.
   *
   * - Notably, if a `typeof` prefix is attached to the key, it will be exclusively defined for `typeof` calls."
   */
  define?:
    | Record<
      string,
      string | number | boolean | undefined | Record<string, unknown>
    >
    | undefined

  /**
   * The {@link Entry} option is used to set the entry module.
   *
   * @remarks
   *
   * If no value is provided, the default value `'./src/index.js'` will be used.
   *
   * @defaultValue `'./src/index.js'`
   *
   * @example
   *
   * - Use a single entry:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     entry: './src/pages/main/index.js',
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use a single entry with multiple entry modules:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     entry: ['./src/prefetch.js', './src/pages/main/index.js'],
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use multiple entries(with multiple entry modules):
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     entry: {
   *       foo: './src/pages/foo/index.js',
   *       bar: ['./src/pages/bar/index.js', './src/post.js'], // multiple entry modules is allowed
   *     },
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Use multiple entries with {@link EntryDescription}:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     entry: {
   *       foo: './src/pages/foo/index.js',
   *       bar: {
   *         import: ['./src/prefetch.js', './src/pages/bar'],
   *       },
   *     },
   *   },
   * })
   * ```
   */
  entry?: Entry | undefined
  /**
   * The `source.exclude` is used to specify JavaScript files that should be excluded from compilation.
   *
   * @remarks
   *
   * By default, Rsbuild compiles JavaScript files in the current directory and TypeScript/JSX files
   * in all directories. Through the `source.exclude` config, you can specify files or directories
   * that should be excluded from compilation.
   * The usage of `source.exclude` is consistent with {@link https://rspack.dev/config/module#ruleexclude | Rule.exclude}
   * in Rspack, which supports passing in strings or regular expressions to match module paths.
   *
   * @example
   *
   * - Exclude specific files or directories
   *
   * You can exclude specific files or directories from compilation to improve build performance
   * or avoid processing certain files:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   source: {
   *     exclude: [
   *       // Exclude all files in the test directory
   *       /[\\/]test[\\/]/,
   *       // Exclude specific file
   *       './src/legacy-file.js',
   *       // Exclude files matching a pattern
   *       /\.stories\.(js|ts)x?$/,
   *     ],
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Exclude third-party dependencies
   *
   * You can exclude specific third-party dependencies that don't need compilation:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * import path from 'node:path'
   * import { createRequire } from 'node:module'
   *
   * const require = createRequire(import.meta.url)
   *
   * export default defineConfig({
   *   source: {
   *     exclude: [
   *       // Exclude specific package
   *       path.dirname(require.resolve('lodash')),
   *       // Exclude using regex pattern
   *       /node_modules[\\/]lodash-es[\\/]/,
   *     ],
   *   },
   * })
   * ```
   */
  exclude?: Rspack.RuleSetCondition[] | undefined

  /**
   * The `source.include` is used to specify additional JavaScript files that need to be compiled.
   *
   * @remarks
   *
   * To avoid redundant compilation, by default, Rsbuild only compiles JavaScript
   * files in the current directory and TypeScript and JSX files in all directories.
   * It does not compile JavaScript files under `node_modules`.
   *
   * Through the `source.include` config, you can specify directories or modules
   * that need to be compiled by Rsbuild.
   * The usage of `source.include` is consistent with {@link https://rspack.dev/config/module#ruleinclude |  Rule.include}
   * in Rspack, which supports passing in strings or regular expressions to match the module path.
   *
   * @example
   *
   * - Compile Npm Packages
   *
   * A typical usage scenario is to compile npm packages under `node_modules`,
   * because some third-party dependencies have ESNext syntax, which may not be supported in Lynx.
   * You can solve the problem by using this config to specify the dependencies
   * that need to be compiled.
   *
   * ```js
   * import { createRequire } from 'node:module'
   * import path from 'node:path'
   *
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * const require = createRequire(import.meta.url)
   *
   * export default defineConfig({
   *   source: {
   *     include: [
   *       // Method 1:
   *       // First get the path of the module by `require.resolve`
   *       // Then pass path.dirname to point to the corresponding directory
   *       path.dirname(require.resolve('query-string')),
   *       // Method 2:
   *       // Match by regular expression
   *       // All paths containing `node_modules/query-string/` will be matched
   *       /node_modules[\\/]query-string[\\/]/,
   *     ],
   *   },
   * })
   * ```
   *
   * @example
   *
   * - Compile Libraries in Monorepo
   *
   * ```js
   * import path from 'node:path'
   * import { fileURLToPath } from 'node:url'
   *
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * const __dirname = path.dirname(fileURLToPath(import.meta.url))
   *
   * const packagesDir = path.resolve(__dirname, '../../packages')
   *
   * export default defineConfig({
   *   source: {
   *     include: [
   *       // Compile all files in Monorepo's package directory
   *       // It is recommended to exclude the node_modules
   *       {
   *         and: [packagesDir, { not: /[\\/]node_modules[\\/]/ }],
   *       },
   *     ],
   *   },
   * })
   * ```
   */
  include?: Rspack.RuleSetCondition[] | undefined

  /**
   * Add a script before the entry file of each page. This script will be executed before the page code.
   * It can be used to execute global logics, such as injecting polyfills, setting global styles, etc.
   *
   * @remarks
   *
   * See {@link https://rsbuild.dev/config/source/pre-entry | source.preEntry} for more details.
   *
   * @example
   *
   * Relative path will be resolved relative to the project root directory.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     preEntry: './src/polyfill.ts',
   *   },
   * })
   * ```
   */
  preEntry?: string | string[] | undefined

  /**
   * The {@link TransformImport} option transforms the import paths to enable modular imports from subpaths of third-party packages, similar to the functionality provided by {@link https://npmjs.com/package/babel-plugin-import | babel-plugin-import}.
   *
   * @example
   *
   * When using the TUX component library, you can import components on demand with the following config:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   source: {
   *     transformImport: [
   *       {
   *         libraryName: 'foo',
   *         customName: 'foo/src/components/{{ member }}/{{ member }}',
   *       },
   *     ],
   *   },
   * })
   * ```
   *
   * This will transform the following source code:
   *
   * ```js
   * import { Button } from 'foo'
   * ```
   *
   * to:
   *
   * ```js
   * import { Button } from 'foo/src/components/Button/Button'
   * ```
   */
  transformImport?: TransformImport[] | undefined

  /**
   * Configure a custom `tsconfig.json` file path to use, can be a relative or absolute path. Defaults to be `./tsconfig.json`.
   *
   * @remarks
   *
   * The `tsconfigPath` configuration affects the following behaviors:
   *
   * - The `paths` field is used to configure {@link Source.alias | Path Aliases}.
   *
   * - Sets the scope and rules for the {@link https://rsbuild.dev/plugins/list/plugin-type-check | Type Check Plugin}.
   *
   * @example
   *
   * Relative path will be resolved relative to the project root directory.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   source: {
   *     tsconfigPath: './tsconfig.build.json',
   *   },
   * })
   * ```
   */
  tsconfigPath?: string | undefined
}
