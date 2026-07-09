// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'

/**
 * Inject the Lynx build defaults that the Rspeedy CLI would otherwise apply
 * before handing the config to Rsbuild.
 *
 * Two kinds of fields are handled differently:
 *
 * - **defaults**: applied only when the user did not set the field. Decided
 *   against `getRsbuildConfig('original')` because Rsbuild merges its own
 *   defaults into the config *before* `modifyRsbuildConfig` runs, so the
 *   incoming config can no longer tell "user set it" from "Rsbuild default".
 * - **forced**: always override the user, because these fields would break the
 *   Lynx output (Lynx produces a bundle template, not an HTML page).
 */
export function pluginLynxDefaults(): RsbuildPlugin {
  return {
    name: 'lynx:preset:defaults',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const original = api.getRsbuildConfig('original')

        // `inlineScripts` mirrors Rspeedy: on unless chunk splitting is enabled.
        const splitChunks = original.splitChunks ?? false
        const inlineScripts = original.output?.inlineScripts
          ?? splitChunks === false

        const defaults: RsbuildConfig = {
          dev: {
            writeToDisk: original.dev?.writeToDisk ?? true,
            progressBar: original.dev?.progressBar ?? true,
            lazyCompilation: original.dev?.lazyCompilation ?? false,
          },
          server: {
            host: original.server?.host ?? '0.0.0.0',
          },
          output: {
            dataUriLimit: original.output?.dataUriLimit ?? 2 * 1024,
            legalComments: original.output?.legalComments ?? 'none',
            sourceMap: typeof original.output?.sourceMap === 'object'
              ? original.output.sourceMap
              : { css: true },
            inlineScripts,
            cssModules: {
              localIdentName: original.output?.cssModules?.localIdentName
                ?? '[local]-[hash:base64:6]',
            },
          },
          splitChunks,
        }

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

        return mergeRsbuildConfig(config, defaults, forced)
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
