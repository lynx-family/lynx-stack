// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { afterEach, beforeEach, describe, expect, rs, test } from '@rstest/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import type { LynxConfig } from '@lynx-js/rsbuild-plugin'

function createLynxConfig(): LynxConfig {
  let config: LynxConfig | undefined
  for (const plugin of pluginLynx()) {
    void plugin.setup({
      expose(_id: string | symbol, value: unknown) {
        config = value as LynxConfig
      },
    } as unknown as RsbuildPluginAPI)
    if (config) break
  }
  if (!config) throw new Error('pluginLynx exposed no Lynx config')
  return config
}

describe('shortcut loop whose dev server closes before its first prompt', () => {
  const api = {
    getNormalizedConfig: rs.fn().mockReturnValue({
      dev: { assetPrefix: 'https://example.com/' },
    }),
    useExposed: rs.fn().mockReturnValue(createLynxConfig()),
  } as unknown as RsbuildPluginAPI

  const ttyDescriptors = new Map<
    NodeJS.ReadStream | NodeJS.WriteStream,
    PropertyDescriptor | undefined
  >()

  beforeEach(() => {
    rs.resetModules()
    for (const stream of [process.stdin, process.stdout] as const) {
      ttyDescriptors.set(
        stream,
        Object.getOwnPropertyDescriptor(stream, 'isTTY'),
      )
      Object.defineProperty(stream, 'isTTY', {
        value: true,
        configurable: true,
      })
    }
  })

  afterEach(() => {
    rs.doUnmock('@clack/prompts')
    rs.doUnmock('../src/showQRCode.js')
    for (const [stream, descriptor] of ttyDescriptors) {
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor)
      } else {
        delete (stream as { isTTY?: boolean }).isTTY
      }
    }
    ttyDescriptors.clear()
  })

  test('does not print for a server that closed while a selection was pending', async () => {
    let selectEntry!: (entry: string) => void
    const select = rs.fn(() =>
      new Promise<string>(resolve => {
        selectEntry = resolve
      })
    )
    const selectKey = rs.fn()
      .mockResolvedValueOnce('r')
      .mockImplementation(() => new Promise<string>(rs.fn()))
    const showQRCode = rs.fn()
    rs.doMock('@clack/prompts', () => ({
      selectKey,
      select,
      autocomplete: rs.fn(),
      isCancel: rs.fn(() => false),
      cancel: rs.fn(),
      log: { success: rs.fn(), info: rs.fn() },
    }))
    rs.doMock('../src/showQRCode.js', () => ({ default: showQRCode }))
    const { registerConsoleShortcuts } = await import('../src/shortcuts.js')
    const onPrint = rs.fn()

    const off = await registerConsoleShortcuts({
      api,
      entries: ['foo', 'bar'],
      schema: i => i,
      port: 3000,
      onPrint,
    })
    await expect.poll(() => select).toHaveBeenCalledTimes(1)
    showQRCode.mockClear()
    onPrint.mockClear()

    // The dev server closes while the entry prompt is still open.
    off()
    selectEntry('bar')
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(onPrint).not.toHaveBeenCalled()
    expect(showQRCode).not.toHaveBeenCalled()
    expect(selectKey).toHaveBeenCalledTimes(1)
  })

  test('does not print the QR code for a server that closed while onPrint was pending', async () => {
    const selectKey = rs.fn()
      .mockResolvedValueOnce('r')
      .mockImplementation(() => new Promise<string>(rs.fn()))
    const showQRCode = rs.fn()
    rs.doMock('@clack/prompts', () => ({
      selectKey,
      select: rs.fn().mockResolvedValue('bar'),
      autocomplete: rs.fn(),
      isCancel: rs.fn(() => false),
      cancel: rs.fn(),
      log: { success: rs.fn(), info: rs.fn() },
    }))
    rs.doMock('../src/showQRCode.js', () => ({ default: showQRCode }))
    const { registerConsoleShortcuts } = await import('../src/shortcuts.js')
    // The first `onPrint` (initial print) resolves right away; the second one
    // (after the entry switch) stays pending.
    let finishPrint!: () => void
    const onPrint = rs.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementation(() =>
        new Promise<void>(resolve => {
          finishPrint = resolve
        })
      )

    const off = await registerConsoleShortcuts({
      api,
      entries: ['foo', 'bar'],
      schema: i => i,
      port: 3000,
      onPrint,
    })
    await expect.poll(() => onPrint).toHaveBeenCalledTimes(2)
    showQRCode.mockClear()

    // The dev server closes while the second `onPrint` is still pending.
    off()
    finishPrint()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(showQRCode).not.toHaveBeenCalled()
    expect(selectKey).toHaveBeenCalledTimes(1)
  })

  test('does not prompt', async () => {
    // The loop reaches its first prompt only after `import('@clack/prompts')`
    // resolves. Hold that import so the dev server can close in between, the
    // way a busy CI runner orders a closing test and the next one.
    const selectKey = rs.fn(() => new Promise<string>(rs.fn()))
    let releasePrompts!: () => void
    const promptsLoaded = new Promise<void>(resolve => {
      releasePrompts = resolve
    })
    const prompts = {
      selectKey,
      select: rs.fn(),
      autocomplete: rs.fn(),
      isCancel: rs.fn(() => false),
      cancel: rs.fn(),
      log: { success: rs.fn(), info: rs.fn() },
    }
    // Rstest only accepts sync mock factories. A `then` export makes the
    // dynamic `import()` adopt the module as a thenable, holding it until
    // `releasePrompts()`.
    rs.doMock('@clack/prompts', () => ({
      ...prompts,
      then(resolve: (value: typeof prompts) => void) {
        void promptsLoaded.then(() => resolve(prompts))
      },
    }))
    rs.doMock('../src/showQRCode.js', () => ({ default: rs.fn() }))
    const { registerConsoleShortcuts } = await import('../src/shortcuts.js')

    const off = await registerConsoleShortcuts({
      api,
      entries: ['foo'],
      schema: i => i,
      port: 3000,
    })
    off()
    releasePrompts()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(selectKey).not.toHaveBeenCalled()
  })
})
