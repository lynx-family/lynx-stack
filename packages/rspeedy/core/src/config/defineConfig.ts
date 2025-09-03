// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Config } from './index.js'

/**
 * The types that `lynx.config.ts` exports.
 */
export type ConfigExport =
  | Config
  | Promise<Config>
  | (() => Config)
  | (() => Promise<Config>)

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
 * @public
 */
export function defineConfig(config: () => Config): () => Config
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
 * @public
 */
export function defineConfig(
  config: () => Promise<Config>,
): () => Promise<Config>
export function defineConfig(config: ConfigExport): ConfigExport {
  return config
}
