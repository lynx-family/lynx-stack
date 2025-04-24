// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that print the template.js url using QRCode.
 */

import type { EnvironmentContext, RsbuildPlugin } from '@rsbuild/core'

import { registerConsoleShortcuts } from './shortcuts.js'

/**
 * {@inheritdoc PluginQRCodeOptions.schema}
 *
 * @public
 */
export type CustomizedSchemaFn = (
  url: string,
) => string | Record<string, string>

/**
 * The options for {@link pluginQRCode}.
 *
 * @public
 */
export interface PluginQRCodeOptions {
  /**
   * Customize the generated schema.
   *
   * @example
   *
   * ```js
   * import { pluginQRCode } from '@lynx-js/plugin-qrcode'
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginQRCode({
   *       schema(url) {
   *         return `lynx://${url}?dev=1`
   *       },
   *     }),
   *   ],
   * })
   * ```
   *
   * @example
   *
   * - Use multiple schemas:
   *
   * You may press `a` in the terminal to switch between schemas.
   *
   * ```js
   * import { pluginQRCode } from '@lynx-js/plugin-qrcode'
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   plugins: [
   *     pluginQRCode({
   *       schema(url) {
   *         return {
   *           http: url,
   *           foo: `foo://lynx?url=${encodeURIComponent(url)}&dev=1`,
   *           bar: `bar://lynx?url=${encodeURIComponent(url)}`,
   *         }
   *       },
   *     }),
   *   ],
   * })
   * ```   */
  schema?: CustomizedSchemaFn | undefined
}

/**
 * Create a rsbuild plugin for printing QRCode.
 *
 * @example
 * ```ts
 * // rsbuild.config.ts
 * import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
 * export default {
 *   plugins: [pluginQRCode()],
 * }
 * ```
 *
 * @public
 */
export function pluginQRCode(
  options?: PluginQRCodeOptions,
): RsbuildPlugin {
  const defaultPluginOptions = {
    schema: (url) => ({ http: url }),
  } satisfies Required<PluginQRCodeOptions>

  const { schema } = Object.assign({}, defaultPluginOptions, options)

  return {
    name: 'lynx:rsbuild:qrcode',
    pre: ['lynx:rsbuild:api'],
    setup(api) {
      api.onAfterStartProdServer(async ({ environments, port }) => {
        await main(environments['lynx'], port)
      })

      let printedQRCode = false

      api.onDevCompileDone(async ({ stats, environments }) => {
        if (!api.context.devServer) {
          return
        }

        if (stats.hasErrors()) {
          return
        }

        if (printedQRCode) {
          return
        }

        printedQRCode = true

        await main(environments['lynx'], api.context.devServer.port)
      })

      api.modifyRsbuildConfig((config) => {
        const originalPrintUrl = config.server?.printUrls
        if (
          originalPrintUrl === false || typeof originalPrintUrl === 'function'
        ) {
          return
        }

        config.server ??= {}
        config.server.printUrls = false
      })

      async function main(
        environmentContext: EnvironmentContext | undefined,
        port: number,
      ) {
        if (!environmentContext) {
          // Not lynx environment, skip print QRCode
          return
        }

        const entries = Object.keys(environmentContext.entry)

        if (entries.length === 0) {
          return
        }

        const unregister = await registerConsoleShortcuts(
          {
            entries,
            api,
            port,
            schema,
          },
        )
        api.onCloseDevServer(unregister)
      }
    },
  }
}
