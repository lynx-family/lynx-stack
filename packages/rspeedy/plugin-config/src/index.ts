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
 * // rsbuild.config.ts
 * import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 * import { defineConfig } from '@rsbuild/core'
 *
 * export default defineConfig({
 *   environments: { lynx: {} },
 *   plugins: [
 *     pluginReactLynx(),
 *     pluginLynxConfig({
 *       alignMouseEventWithW3C: true,
 *     }),
 *   ],
 * })
 * ```
 */

export { pluginLynxConfig } from './pluginLynxConfig.js'

export type { Config, Options } from './pluginLynxConfig.js'
