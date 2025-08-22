// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Config } from './index.js'

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
 * //@ts-check
 * import { defineConfig } from '@lynx-js/rspeedy'
 * export default defineConfig({
 *   // autocompletion works here!
 * })
 * ```
 *
 * @public
 */
export type ConfigExport =
  | Config
  | Promise<Config>
  | (() => Config)
  | (() => Promise<Config>)
export function defineConfig(config: Config): Config
export function defineConfig(config: () => Config): () => Config
export function defineConfig(config: Promise<Config>): Promise<Config>
export function defineConfig(
  config: () => Promise<Config>,
): () => Promise<Config>
export function defineConfig(
  config: ConfigExport,
): ConfigExport {
  return config
}
