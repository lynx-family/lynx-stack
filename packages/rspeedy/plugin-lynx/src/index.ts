// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A single Rsbuild plugin that turns a plain Rsbuild project into a Lynx one,
 * so a Lynx app can be built with the Rsbuild CLI directly instead of the
 * Rspeedy CLI.
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { defineConfig } from '@rsbuild/core'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 *
 * import { pluginLynx } from '@lynx-js/rsbuild-plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginLynx(), pluginReactLynx()],
 *   environments: { lynx: {} },
 * })
 * ```
 */

import type { RsbuildPlugins } from '@rsbuild/core'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import { pluginLynxDefaults } from './defaults.js'
import {
  pluginChunkLoading,
  pluginDev,
  pluginMinify,
  pluginOptimization,
  pluginOutput,
  pluginResolve,
  pluginRsdoctor,
  pluginSourcemap,
  pluginStatsJson,
  pluginSwc,
  pluginTarget,
} from './internal.js'
import { pluginLynxAPI } from './plugin-api.js'

const DEFAULT_FILENAME = '[name].[platform].bundle'

/**
 * Compose all the plugins the Rspeedy CLI applies by default, plus the Lynx
 * config defaults, into a single plugin usable from `rsbuild.config.ts`.
 *
 * @public
 */
export function pluginLynx(): RsbuildPlugins {
  // The Lynx-shaped config published to DSL plugins. `output.filename.bundle`
  // is read by `pluginReactLynx` (to name the emitted template) and by
  // `pluginQRCode` (to build dev URLs).
  const exposedConfig = {
    output: {
      filename: {
        bundle: DEFAULT_FILENAME,
        template: DEFAULT_FILENAME,
      },
    },
  }

  return [
    pluginLynxAPI(exposedConfig),
    pluginLynxDefaults(),

    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginDev(),
    pluginMinify(),
    pluginOptimization(),
    pluginOutput(),
    pluginResolve(),
    pluginRsdoctor(),
    pluginSourcemap(),
    pluginStatsJson(),
    pluginSwc(),
    pluginTarget(),
    pluginCssMinimizer(),
  ]
}
