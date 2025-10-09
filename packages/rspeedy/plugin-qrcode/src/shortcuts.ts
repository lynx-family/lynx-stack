// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { ExposedAPI } from '@lynx-js/rspeedy'

import {
  generateExplorerDevUrls,
  generateWebDevUrls,
} from './generateDevUrls.js'

import type { CustomizedSchemaFn } from './index.js'

const gExistingShortcuts = new WeakSet<Options>()

interface Options {
  api: RsbuildPluginAPI
  entries: string[]
  webEntries: string[]
  schema: CustomizedSchemaFn
  port: number
  customShortcuts?: Record<
    string,
    { value: string, label: string, hint?: string, action?(): Promise<void> }
  >
  onPrint?:
    | ((lynx?: string, web?: Record<string, string>) => Promise<void>)
    | undefined
}

export async function registerConsoleShortcuts(
  options: Options,
): Promise<() => void> {
  const [
    { default: showQRCode },
  ] = await Promise.all([
    import('./showQRCode.js'),
  ])

  // keep the default entry to be lynx explorer entry if exists
  const currentEntry = options.entries[0]
  const devUrls = currentEntry
    ? generateExplorerDevUrls(
      options.api,
      currentEntry,
      options.schema,
      options.port,
    )
    : undefined

  const value: string | symbol | undefined = devUrls
    ? Object.values(devUrls)[0]
    : undefined
  const webUrls = generateWebDevUrls(
    options.api,
    options.webEntries,
    options.port,
  )
  await options.onPrint?.(
    value,
    webUrls,
  )
  showQRCode(value, webUrls)

  gExistingShortcuts.add(options)

  // We should not `await` on this since it would block the NodeJS main thread.
  void loop(options, value, devUrls, webUrls)

  function off() {
    gExistingShortcuts.delete(options)
  }
  return off
}

async function loop(
  options: Options,
  value: string | symbol | undefined,
  devUrls: Record<string, string> | undefined,
  webUrls: Record<string, string>,
) {
  const [
    { autocomplete, select, selectKey, isCancel, cancel },
    { default: showQRCode },
  ] = await Promise.all([
    import('@clack/prompts'),
    import('./showQRCode.js'),
  ])

  const selectFn = (length: number) => length > 5 ? autocomplete : select

  let currentEntry = options.entries[0]
  let currentSchema = devUrls ? Object.keys(devUrls)[0]! : undefined

  while (!isCancel(value)) {
    const name = await selectKey({
      message: 'Usage',
      options: [
        { value: 'r', label: 'Switch entries' },
        { value: 'a', label: 'Switch schema' },
        { value: 'h', label: 'Help' },
        ...Object.values(options.customShortcuts ?? {}),
        { value: 'q', label: 'Quit' },
      ],
      initialValue: 'q' as string,
    })

    if (
      // User cancel, exit the process
      isCancel(name) || name === 'q'
      // Auto restart, stop the loop but avoid exiting the process
      || !gExistingShortcuts.has(options)
    ) {
      break
    }
    if (name === 'r' && currentSchema) {
      const selection = await selectFn(options.entries.length)({
        message: 'Select entry',
        options: options.entries.map(entry => ({
          value: entry,
          label: entry,
          hint: generateExplorerDevUrls(
            options.api,
            entry,
            options.schema,
            options.port,
          )[currentSchema!]!,
        })),
        initialValue: currentEntry,
      })
      if (isCancel(selection)) {
        break
      }
      currentEntry = selection
      value = getCurrentUrl()
    } else if (name === 'a' && currentEntry) {
      const devUrls = generateExplorerDevUrls(
        options.api,
        currentEntry,
        options.schema,
        options.port,
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
    } else if (options.customShortcuts?.[name]) {
      await options.customShortcuts[name].action?.()
    }
    await options.onPrint?.(value, webUrls)
    showQRCode(value, webUrls)
  }

  // If the `options` is not deleted from `gExistingShortcuts`, means that this is an explicitly
  // exiting requested by the user. We should exit the process.
  // Otherwise, this is exit by devServer restart, we should not exit the process.
  if (gExistingShortcuts.has(options)) {
    await exit(1)
  }

  return

  function getCurrentUrl(): string {
    return (currentEntry && currentSchema)
      ? generateExplorerDevUrls(
        options.api,
        currentEntry,
        options.schema,
        options.port,
      )[currentSchema]!
      : ''
  }

  function exit(code?: number) {
    cancel('exiting...')
    // biome-ignore lint/correctness/useHookAtTopLevel: not react hooks
    const { exit } = options.api.useExposed<ExposedAPI>(
      Symbol.for('rspeedy.api'),
    )!
    return exit(code)
  }
}
