// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { logger } from '@rsbuild/core'
import type { RsbuildEntry } from '@rsbuild/core'

import type { Config } from './config/index.js'

/**
 * The exposed API of Rspeedy. Can be used in Rsbuild plugin with {@link https://rsbuild.rs/plugins/dev/core#apiuseexposed | api.useExposed}.
 *
 * @public
 *
 * @example
 *
 * ```ts
 * import type { ExposedAPI } from '@lynx-js/rspeedy'
 * const RsbuildPlugin = {
 *   name: 'my-rsbuild-plugin',
 *   pre: ['lynx:rsbuild:plugin-api'],
 *   setup(api) {
 *     const rspeedyAPI = api.useExposed<ExposedAPI>(Symbol.for('rspeedy.api'))
 *   },
 * }
 * ```
 */
export interface ExposedAPI {
  /**
   * The user config.
   */
  config: Config

  /**
   * Print debug logs.
   *
   * @param message - The printed message.
   */
  debug: (message: string | (() => string)) => void

  /**
   * Exit the process.
   *
   * @param code - The exit code.
   */
  exit: (code?: number) => Promise<void> | void

  /**
   * Get the Rspeedy logger.
   */
  logger: typeof logger

  /**
   * The version of Rspeedy.
   */
  version: string

  /**
   * Used for plugin qrcode get entry points from self-defined environments rather than default lynx environment.
   */
  entries?: RsbuildEntry
}
