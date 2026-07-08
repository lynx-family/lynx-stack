// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that print the template.js url using QRCode.
 */

import type {
  EnvironmentContext,
  RsbuildConfig,
  RsbuildPlugin,
} from '@rsbuild/core'

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
   * import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
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
   * import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
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

  /**
   * Opt in to the fullscreen variant of the Lynx bundle URL (appends
   * `?fullscreen=true`, opening the bundle in LynxExplorer with the in-app
   * navigation chrome stripped).
   *
   * When enabled, the plugin:
   * - Appends a `fullscreen` entry to the schema rotation — the QR keeps
   *   opening on your default schema; press `a` in the dev console to switch
   *   to the `fullscreen` variant.
   * - Appends an `∟ Fullscreen` URL line under each Lynx bundle URL printed
   *   by the dev server.
   *
   * @defaultValue `false`
   */
  fullscreen?: boolean | undefined
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
    fullscreen: false,
  } satisfies Required<PluginQRCodeOptions>

  const { schema, fullscreen } = Object.assign(
    {},
    defaultPluginOptions,
    options,
  )

  const effectiveSchema = fullscreen ? withFullscreenSchema(schema) : schema

  return {
    name: 'lynx:rsbuild:qrcode',
    pre: ['lynx:rsbuild:api'],
    setup(api) {
      if (fullscreen) {
        api.modifyRsbuildConfig({
          order: 'post',
          handler: (config, { mergeRsbuildConfig }) => {
            const prev = config.server?.printUrls
            if (typeof prev !== 'function') return
            return mergeRsbuildConfig(config, {
              server: { printUrls: wrapPrintUrlsWithFullscreen(prev) },
            })
          },
        })
      }

      let unregisterPreviewShortcuts: (() => void) | undefined

      api.onExit(() => {
        unregisterPreviewShortcuts?.()
        unregisterPreviewShortcuts = undefined
      })

      api.onAfterStartPreviewServer(async ({ environments, routes, port }) => {
        unregisterPreviewShortcuts?.()
        unregisterPreviewShortcuts = await main(
          getEntriesFromRoutes(routes, environments),
          port,
        )
      })

      api.onAfterStartDevServer(async ({ environments, routes, port }) => {
        const entries = getEntriesFromRoutes(routes, environments)

        if (entries.length === 0) {
          return
        }

        const unregister = await registerConsoleShortcuts(
          {
            entries,
            api,
            port,
            schema: effectiveSchema,
          },
        )
        if (unregister) {
          api.onCloseDevServer(unregister)
        }
      })

      async function main(
        entries: string[],
        port: number,
      ): Promise<(() => void) | undefined> {
        if (entries.length === 0) {
          return
        }

        const unregister = await registerConsoleShortcuts(
          {
            entries,
            api,
            port,
            schema: effectiveSchema,
          },
        )
        return unregister
      }
    },
  }
}

function getEntriesFromRoutes(
  routes: { entryName: string }[],
  environments: Record<string, EnvironmentContext>,
): string[] {
  const entries = new Set(Object.keys(environments['lynx']?.entry ?? {}))
  return [
    ...new Set(
      routes
        .map(route => route.entryName)
        .filter(entryName => entries.has(entryName)),
    ),
  ]
}

type PrintUrlsFn = Extract<
  NonNullable<NonNullable<RsbuildConfig['server']>['printUrls']>,
  (...args: never[]) => unknown
>

/**
 * Wrap a `server.printUrls` function so that each `Lynx`-labelled URL is
 * followed by an `∟ Fullscreen` entry with `?fullscreen=true`.
 *
 * @internal
 */
export function wrapPrintUrlsWithFullscreen(
  prev: PrintUrlsFn,
): PrintUrlsFn {
  return (params) => {
    const urls = prev(params) ?? []
    const out: typeof urls = []
    for (const entry of urls) {
      out.push(entry)
      if (typeof entry !== 'string' && entry.label === 'Lynx') {
        out.push({
          label: '∟ Fullscreen',
          url: appendFullscreenParam(entry.url),
        })
      }
    }
    return out
  }
}

/**
 * Wrap a user-provided schema function so that the returned schema map gains a
 * `fullscreen` entry appended to the rotation. The variant is derived from the
 * first URL in the user's schema output by appending `?fullscreen=true` —
 * the user's existing first entry stays as the initial QR (preserving pre-PR
 * behavior), and the `a` shortcut switches to `fullscreen`.
 *
 * @internal
 */
export function withFullscreenSchema(
  schemaFn: CustomizedSchemaFn,
): CustomizedSchemaFn {
  return (rawUrl) => {
    const result = schemaFn(rawUrl)
    const map = typeof result === 'string' ? { default: result } : { ...result }
    const firstUrl = Object.values(map)[0]
    if (firstUrl === undefined) {
      return map
    }
    return { ...map, fullscreen: appendFullscreenParam(firstUrl) }
  }
}

function appendFullscreenParam(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.searchParams.set('fullscreen', 'true')
    return url.toString()
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${separator}fullscreen=true`
  }
}
