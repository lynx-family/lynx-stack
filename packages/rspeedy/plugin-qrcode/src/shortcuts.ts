// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { ExposedAPI } from '@lynx-js/rspeedy'

import generateDevUrls from './generateDevUrls.js'

import type { CustomizedSchemaFn } from './index.js'

// One reader serves the whole process. It looks up the current registration
// before every prompt and again once a key arrives, so a dev-server restart
// (`off()` followed by a new `registerConsoleShortcuts`) hands a pending
// prompt over to the replacement instead of opening a second one or
// swallowing the key.
let gCurrent: Options | undefined
let gLoop: Promise<void> | undefined

interface Options {
  api: RsbuildPluginAPI
  entries: string[]
  schema: CustomizedSchemaFn
  port: number
  /**
   * Whether to render the ASCII QR code in the terminal.
   *
   * When `false`, the plugin still prints the URL(s) and keeps the interactive
   * shortcuts working, but skips the QR code block. Useful for hosts that
   * always launch via a schema / deep link and don't need the scan flow, or
   * for terminals where the QR block is visually noisy.
   *
   * @defaultValue `true`
   */
  showQRCode?: boolean | undefined
  customShortcuts?: Record<
    string,
    { value: string, label: string, hint?: string, action?(): Promise<void> }
  >
  onPrint?: ((url: string) => Promise<void>) | undefined
}

export async function registerConsoleShortcuts(
  options: Options,
): Promise<() => void> {
  // Non-TTY: print structured list of all entries and return early
  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    await printNonTTY(options)
    return () => {/* noop */}
  }

  const [
    { default: showQRCode },
  ] = await Promise.all([
    import('./showQRCode.js'),
  ])
  const shouldShowQRCode = options.showQRCode ?? true

  const currentEntry = options.entries[0]!
  const devUrls = generateDevUrls(
    options.api,
    currentEntry,
    options.schema,
    options.port,
  )

  const value: string | symbol = Object.values(devUrls)[0]!
  await options.onPrint?.(value)
  if (shouldShowQRCode) {
    showQRCode(value)
  }

  gCurrent = options

  // We should not `await` on this since it would block the NodeJS main thread.
  gLoop ??= loop(value).finally(() => {
    gLoop = undefined
  })

  function off() {
    if (gCurrent === options) {
      gCurrent = undefined
    }
  }
  return off
}

async function printNonTTY(options: Options): Promise<void> {
  const lines: string[] = []
  const urls: string[] = []

  for (const entry of options.entries) {
    const devUrls = generateDevUrls(
      options.api,
      entry,
      options.schema,
      options.port,
    )

    lines.push(entry)
    for (const [schemaName, url] of Object.entries(devUrls)) {
      lines.push(`  ${schemaName}: ${url}`)
      urls.push(url)
    }
  }

  process.stdout.write(lines.join('\n') + '\n')

  for (const url of urls) {
    await options.onPrint?.(url)
  }
}

async function loop(value: string | symbol) {
  const [
    { autocomplete, select, selectKey, isCancel, cancel },
    { default: showQRCode },
  ] = await Promise.all([
    import('@clack/prompts'),
    import('./showQRCode.js'),
  ])

  const selectFn = (length: number) => length > 5 ? autocomplete : select

  let options: Options | undefined
  let currentEntry = ''
  let currentSchema = ''

  while (!isCancel(value) && gCurrent) {
    follow(gCurrent)
    const name = await selectKey({
      message: 'Usage',
      options: [
        { value: 'r', label: 'Switch entries' },
        { value: 'a', label: 'Switch schema' },
        { value: 'h', label: 'Help' },
        ...Object.values(options!.customShortcuts ?? {}),
        { value: 'q', label: 'Quit' },
      ],
      initialValue: 'q' as string,
    })

    if (!gCurrent) {
      // The dev server closed while waiting and nothing replaced it: stop
      // without exiting the process.
      break
    }
    // A restart may have replaced the registration while waiting; act for
    // the replacement.
    follow(gCurrent)

    if (isCancel(name) || name === 'q') {
      break
    }
    if (name === 'r') {
      const selection = await selectFn(options!.entries.length)({
        message: 'Select entry',
        options: options!.entries.map(entry => ({
          value: entry,
          label: entry,
          hint: generateDevUrls(
            options!.api,
            entry,
            options!.schema,
            options!.port,
          )[currentSchema]!,
        })),
        initialValue: currentEntry,
      })
      if (isCancel(selection)) {
        break
      }
      currentEntry = selection
      value = getCurrentUrl()
    } else if (name === 'a') {
      const devUrls = generateDevUrls(
        options!.api,
        currentEntry,
        options!.schema,
        options!.port,
      )
      const selection = await selectFn(Object.keys(devUrls).length)({
        message: 'Select schema',
        options: Object.entries(devUrls).map(([name, url]) => ({
          value: name,
          label: name,
          hint: url,
        })),
        initialValue: currentSchema,
      })
      if (isCancel(selection)) {
        break
      }
      currentSchema = selection
      value = getCurrentUrl()
    } else if (options!.customShortcuts?.[name]) {
      await options!.customShortcuts[name].action?.()
    }
    await options!.onPrint?.(value)
    if (options!.showQRCode ?? true) {
      showQRCode(value)
    }
  }

  // A live registration means the user asked to quit; exit the process.
  // Otherwise the dev server closed the shortcuts (restart) and the process
  // must stay alive.
  if (gCurrent) {
    await exit(gCurrent, 1)
  }

  return

  function follow(next: Options): void {
    if (next === options) {
      return
    }
    options = next
    currentEntry = next.entries[0]!
    currentSchema = Object.keys(generateDevUrls(
      next.api,
      currentEntry,
      next.schema,
      next.port,
    ))[0]!
  }

  function getCurrentUrl(): string {
    return generateDevUrls(
      options!.api,
      currentEntry,
      options!.schema,
      options!.port,
    )[currentSchema]!
  }

  function exit(current: Options, code?: number) {
    cancel('exiting...')
    // biome-ignore lint/correctness/useHookAtTopLevel: not react hooks
    const { exit } = current.api.useExposed<ExposedAPI>(
      Symbol.for('rspeedy.api'),
    )!
    return exit(code)
  }
}
