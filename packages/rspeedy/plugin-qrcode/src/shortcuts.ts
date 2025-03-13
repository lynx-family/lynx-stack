// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { ExposedAPI } from '@lynx-js/rspeedy'

import generateDevUrls from './generateDevUrls.js'
import { connectNgrokTunnel } from './tunnel.js'
import type { TunnelData } from './tunnel.js'

import type { CustomizedSchemaFn } from './index.js'

const gExistingShortcuts = new WeakSet<Options>()

interface Options {
  api: RsbuildPluginAPI
  entries: string[]
  schema: CustomizedSchemaFn
  port: number
  customShortcuts?: Record<
    string,
    { value: string, label: string, hint?: string, action?(): Promise<void> }
  >
  onPrint?: ((url: string) => Promise<void>) | undefined
  tunnel: TunnelData
}

export async function registerConsoleShortcuts(
  options: Options,
): Promise<() => void> {
  const [
    { default: showQRCode },
    { log },
  ] = await Promise.all([
    import('./showQRCode.js'),
    import('@clack/prompts'),
  ])

  const currentEntry = options.entries[0]!

  if (options.tunnel.isOpen && options.tunnel.url === '') {
    const tunnelUrl = await connectNgrokTunnel(options.tunnel)
    if (tunnelUrl === null) {
      options.tunnel.url = ''
      options.tunnel.isOpen = false
      log.error(
        'Unable to connect to the ngrok \nfalling back to localhost',
      )
    } else {
      options.tunnel.url = tunnelUrl
      options.tunnel.isOpen = true
    }
  }
  const devUrls = generateDevUrls(
    options.api,
    currentEntry,
    options.schema,
    options.port,
    options.tunnel,
  )

  const value: string | symbol = Object.values(devUrls)[0]!
  await options.onPrint?.(value)
  await showQRCode(value)

  gExistingShortcuts.add(options)

  // We should not `await` on this since it would block the NodeJS main thread.
  void loop(options, value, devUrls)

  function off() {
    gExistingShortcuts.delete(options)
  }
  return off
}

async function loop(
  options: Options,
  value: string | symbol,
  devUrls: Record<string, string>,
) {
  const [
    { select, selectKey, isCancel, cancel, log },
    { default: showQRCode },
  ] = await Promise.all([
    import('@clack/prompts'),
    import('./showQRCode.js'),
  ])

  let currentEntry = options.entries[0]!
  let currentSchema = Object.keys(devUrls)[0]!

  while (!isCancel(value)) {
    const tunnelLabel = `Tunnel(${
      options.tunnel.isOpen ? 'Active' : 'Deactive'
    })`
    const name = await selectKey({
      message: 'Usage',
      options: [
        { value: 'r', label: 'Switch entries' },
        { value: 'a', label: 'Switch schema' },
        { value: 'h', label: 'Help' },
        { value: 't', label: tunnelLabel },
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
    if (name === 't') {
      if (options.tunnel.isOpen) {
        options.tunnel.isOpen = false
        options.tunnel.url = ''
      } else {
        const tunnelUrl: string | null = await connectNgrokTunnel(
          options.tunnel,
        )
        if (tunnelUrl === null) {
          log.error(
            'Unable to connect to the ngrok \nfalling back to localhost',
          )
        } else {
          options.tunnel.isOpen = true
          options.tunnel.url = tunnelUrl
        }
      }
      value = getCurrentUrl()
      await options.onPrint?.(value)
      await showQRCode(value)
    }

    if (name === 'r') {
      const selection = await select({
        message: 'Select entry',
        options: options.entries.map(entry => ({
          value: entry,
          label: entry,
          hint: generateDevUrls(
            options.api,
            entry,
            options.schema,
            options.port,
            options.tunnel,
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
        options.api,
        currentEntry,
        options.schema,
        options.port,
        options.tunnel,
      )
      const selection = await select({
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
    await options.onPrint?.(value)
    await showQRCode(value)
  }

  // If the `options` is not deleted from `gExistingShortcuts`, means that this is an explicitly
  // exiting requested by the user. We should exit the process.
  // Otherwise, this is exit by devServer restart, we should not exit the process.
  if (gExistingShortcuts.has(options)) {
    await exit(1)
  }

  return

  function getCurrentUrl(): string {
    return generateDevUrls(
      options.api,
      currentEntry,
      options.schema,
      options.port,
      options.tunnel,
    )[currentSchema]!
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
