// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Config } from './index.js'

/**
 *  Parameters for the function exported from `lynx.config.js`.
 *
 * @public
 */
export interface ConfigParams {
  /**
   * The value of `process.env['NODE_ENV']`
   *
   * @remarks
   * Common values include (non-exhaustive):
   * - `'production'`
   *
   * - `'development'`
   *
   * - `'test'`
   */
  env: 'production' | 'development' | 'test' | (string & Record<never, never>)
  /**
   * The CLI command of Rspeedy.
   *
   * @remarks
   *
   * Possible values:
   *
   * - `'build'`
   *
   * - `'dev'`
   *
   * - `'inspect'`
   *
   * - `'preview'`
   */
  command:
    | 'build'
    | 'dev'
    | 'inspect'
    | 'preview'
    | (string & Record<never, never>)
}

/**
 * The types that `lynx.config.ts` exports.
 */
export type ConfigExport =
  | Config
  | Promise<Config>
  | ((params: ConfigParams) => Config)
  | ((params: ConfigParams) => Promise<Config>)

/**
 * The `defineConfig` method is a helper function used to get TypeScript intellisense.
 *
 * @param config - The config of Rspeedy.
 * @returns - The identical config as the input config.
 *
 * @example
 *
 * Use `defineConfig` in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   // autocompletion works here!
 * })
 * ```
 *
 * @public
 */
export function defineConfig(config: Config): Config
/**
 * The `defineConfig` method is a helper function used to get TypeScript intellisense.
 *
 * @param config - The function that returns a config of Rspeedy.
 * @returns - The identical function as the input.
 *
 * @example
 *
 * Use `defineConfig` in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig(() => {
 *   return {
 *     // autocompletion works here!
 *   }
 * })
 * ```
 *
 * @example
 *
 * Use `defineConfig` with parameters in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 *
 * export default defineConfig(({ env }) => {
 *   const isTest = env === 'test'
 *   return {
 *     output: {
 *       minify: isTest ? false : true,
 *     },
 *   }
 * })
 * ```
 *
 * @public
 */
export function defineConfig(
  config: (params: ConfigParams) => Config,
): (params: ConfigParams) => Config
/**
 * The `defineConfig` method is a helper function used to get TypeScript intellisense.
 *
 * @param config - The promise that resolves to a config of Rspeedy.
 * @returns - The identical promise as the input.
 *
 * @example
 *
 * Use `defineConfig` in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 *
 * export default defineConfig(
 *   import('@lynx-js/react-rsbuild-plugin').then(({ pluginReactLynx }) => ({
 *     plugins: [pluginReactLynx()],
 *   })),
 * );
 * ```
 *
 * @public
 */
export function defineConfig(config: Promise<Config>): Promise<Config>
/**
 * The `defineConfig` method is a helper function used to get TypeScript intellisense.
 *
 * @param config - The function that returns a promise that resolves to a config of Rspeedy.
 * @returns - The identical function as the input.
 *
 * @example
 *
 * Use `defineConfig` in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig(async () => {
 *   const foo = await bar()
 *   return {
 *     // autocompletion works here!
 *   }
 * })
 * ```
 *
 * @example
 *
 * Use `defineConfig` with parameters in `lynx.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@lynx-js/rspeedy'
 *
 * export default defineConfig(async ({ env }) => {
 *   const foo = await bar()
 *   const isTest = env === 'test'
 *   return {
 *     output: {
 *       minify: isTest ? false : true,
 *     },
 *   }
 * })
 * ```
 *
 * @public
 */
export function defineConfig(
  config: (params: ConfigParams) => Promise<Config>,
): (params: ConfigParams) => Promise<Config>
export function defineConfig(config: ConfigExport): ConfigExport {
  return config
}
