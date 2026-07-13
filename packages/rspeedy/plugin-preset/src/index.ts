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
 * import { pluginLynxPreset } from '@lynx-js/preset-rsbuild-plugin'
 *
 * export default defineConfig({
 *   plugins: [pluginLynxPreset(), pluginReactLynx()],
 *   environments: { lynx: {} },
 * })
 * ```
 */

import type { RsbuildPlugins } from '@rsbuild/core'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'

import { composeLynxBuildPlugins } from './build-plugins.js'
import { applyDefaultRspeedyConfig } from './config/defaults.js'
import type { Config } from './config/index.js'
import { loadConfig } from './config/loadConfig.js'
import type {
  LoadConfigOptions,
  LoadConfigResult,
} from './config/loadConfig.js'
import { pluginLynxConfig } from './defaults.js'
import { pluginLynxAPI } from './plugin-api.js'

/**
 * Compose all the plugins the Rspeedy CLI applies by default, plus the Lynx
 * config defaults, into a single plugin usable from `rsbuild.config.ts`.
 *
 * @param config - An optional Lynx {@link Config} (the same shape as
 * `lynx.config.ts`). A project migrating off the Rspeedy CLI can pass its
 * existing config here; its `source`, `output`, `resolve`, `dev`,
 * `performance`, `tools`, etc. are translated into the Rsbuild build.
 *
 * @public
 */
export function pluginLynxPreset(config: Config = {}): RsbuildPlugins {
  // Resolve once: fill the Lynx defaults (filename, sourceMap, cssModules, …)
  // so both the exposed config (read by DSL plugins like `pluginReactLynx` and
  // `pluginQRCode`) and the Rsbuild-config translation see the same values.
  const resolved = applyDefaultRspeedyConfig(config)

  return [
    pluginLynxAPI(resolved),
    pluginLynxConfig(resolved),

    // The Lynx build plugins, shared with the Rspeedy CLI (single source of
    // truth for the set/order/args — see `composeLynxBuildPlugins`).
    ...composeLynxBuildPlugins(resolved),

    pluginCssMinimizer(),
  ]
}

/**
 * Load (and validate) a `lynx.config.ts` and return the Lynx {@link Config},
 * so an existing Rspeedy project can be built with the Rsbuild CLI without
 * rewriting its config:
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { defineConfig } from '@rsbuild/core'
 * import { loadLynxConfig, pluginLynxPreset } from '@lynx-js/preset-rsbuild-plugin'
 *
 * export default defineConfig(async () => ({
 *   plugins: [pluginLynxPreset(await loadLynxConfig())],
 * }))
 * ```
 *
 * @public
 */
export async function loadLynxConfig(
  options: LoadConfigOptions = {},
): Promise<Config> {
  const { content } = await loadConfig(options)
  return content
}

// Config loading, re-exported by `@lynx-js/rspeedy` for the CLI's public API.
export { loadConfig }
export type { LoadConfigOptions, LoadConfigResult }
export { defineConfig } from './config/defineConfig.js'
export type { ConfigParams } from './config/defineConfig.js'

// The Lynx-shaped config surface. Re-exported by `@lynx-js/rspeedy` so the
// `import { Config } from '@lynx-js/rspeedy'` used by DSL plugins keeps working.
export type { ExposedAPI } from './api.js'
export { mergeRspeedyConfig } from './config/mergeRspeedyConfig.js'
export type { Config } from './config/index.js'

// The granular config sub-types (`Output`, `Source`, `Dev`, ...) are published
// under the `@lynx-js/preset-rsbuild-plugin/config` subpath (see
// `./config-types.ts`) to keep this top-level entry small. They are all
// reachable through `Config` (e.g. `Config['output']`).
