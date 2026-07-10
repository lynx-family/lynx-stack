// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'

import type { Config } from './config/index.js'
import { toRsbuildConfig } from './config/rsbuild/index.js'

/**
 * Translate the (already default-applied) Lynx {@link Config} into an Rsbuild
 * config and merge it into the build, so a `rsbuild.config.ts` gets the same
 * defaults the Rspeedy CLI applies — and so a migrating project can pass its
 * `lynx.config.ts` contents straight into `pluginLynxPreset(config)`.
 *
 * Merge precedence (lowest to highest):
 * 1. Rsbuild's own defaults (already merged into the incoming `config`).
 * 2. The Lynx-translated config (this is where `pluginLynxPreset(config)` lands).
 * 3. The user's explicit `rsbuild.config.ts` — read via `getRsbuildConfig('original')`
 *    so Rsbuild's defaults are not mistaken for user intent.
 * 4. `forced` fields Lynx requires (it emits a bundle template, not an HTML page).
 */
export function pluginLynxConfig(resolved: Config): RsbuildPlugin {
  return {
    name: 'lynx:preset:config',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const original = api.getRsbuildConfig('original')
        // Drop `plugins` from the re-asserted native layer: `mergeRsbuildConfig`
        // concatenates plugin arrays, and `config` already carries them.
        const { plugins: _plugins, ...native } = original

        const translated = toRsbuildConfig(resolved) as RsbuildConfig

        const forced: RsbuildConfig = {
          output: {
            charset: 'utf8',
            polyfill: 'off',
          },
          tools: {
            htmlPlugin: false,
          },
        }

        warnForcedOverrides(original)

        return mergeRsbuildConfig(config, translated, native, forced)
      })
    },
  }
}

function warnForcedOverrides(original: RsbuildConfig): void {
  const htmlPlugin = (original.tools as { htmlPlugin?: unknown } | undefined)
    ?.htmlPlugin
  if (htmlPlugin !== undefined && htmlPlugin !== false) {
    logger.warn(
      '[lynx-preset] `tools.htmlPlugin` is forced to `false`: Lynx does not produce an HTML page.',
    )
  }
  if (
    original.output?.polyfill !== undefined
    && original.output.polyfill !== 'off'
  ) {
    logger.warn(
      '[lynx-preset] `output.polyfill` is forced to `"off"` for Lynx.',
    )
  }
}
