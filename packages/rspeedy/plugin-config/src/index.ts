// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * An rsbuild plugin for config Lynx Config defined by `@lynx-js/type-config`.
 *
 * @example
 * ```ts
 * import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
 * import { defineConfig } from '@lynx-js/rspeedy'
 *
 * export default defineConfig({
 *   plugins: [
 *     pluginLynxConfig({
 *       enableCheckExposureOptimize: false,
 *     }),
 *   ],
 * })
 * ```
 */

export { pluginLynxConfig } from './pluginLynxConfig.js'

export type { Config, Options } from './pluginLynxConfig.js'
