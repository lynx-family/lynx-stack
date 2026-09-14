// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { beforeEach, describe, expect, rs, test } from '@rstest/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import type { LynxConfig } from '@lynx-js/rsbuild-plugin'

import { registerConsoleShortcuts } from '../src/shortcuts.js'

rs.mock('@clack/prompts')

// Built by `pluginLynx` itself, so the resolver under test is the real one
// rather than a stub that fabricates it.
function createLynxConfig(): LynxConfig {
  let config: LynxConfig | undefined

  for (const plugin of pluginLynx()) {
    // `pluginConfig.setup` is synchronous, so the config is set before the
    // check below.
    void plugin.setup({
      expose(_id: string | symbol, value: unknown) {
        config = value as LynxConfig
      },
    } as unknown as RsbuildPluginAPI)

    if (config) {
      break
    }
  }

  if (!config) {
    throw new Error('pluginLynx exposed no Lynx config')
  }

  return config
}

describe('PluginQRCode - CLI Shortcuts', () => {
  const mockedRsbuildAPI = {
    getNormalizedConfig: rs.fn().mockReturnValue({
      dev: { assetPrefix: 'https://example.com/' },
    }),
    useExposed: rs.fn().mockReturnValue(createLynxConfig()),
  } as unknown as RsbuildPluginAPI

  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    })

    return () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      })
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      })
    }
  })

  describe('non-TTY mode', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      })
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        configurable: true,
      })
    })

    test('prints all entries with all schema URLs', async () => {
      const writeSpy = rs.spyOn(process.stdout, 'write').mockReturnValue(true)

      await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo', 'bar'],
        schema: i => i,
        port: 3000,
      })

      expect(writeSpy).toHaveBeenCalledTimes(1)
      const output = writeSpy.mock.calls[0]![0] as string
      expect(output).toContain('foo')
      expect(output).toContain('bar')
      expect(output).toContain('https://example.com/foo.lynx.bundle')
      expect(output).toContain('https://example.com/bar.lynx.bundle')
      writeSpy.mockRestore()
    })

    test('calls onPrint for every schema URL', async () => {
      const onPrint = rs.fn()

      await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo', 'bar'],
        schema: i => i,
        port: 3000,
        onPrint,
      })

      expect(onPrint).toHaveBeenCalledTimes(2)
      expect(onPrint).toHaveBeenCalledWith(
        'https://example.com/foo.lynx.bundle',
      )
      expect(onPrint).toHaveBeenCalledWith(
        'https://example.com/bar.lynx.bundle',
      )
    })

    test('does not enter interactive loop', async () => {
      const { selectKey } = await import('@clack/prompts')

      await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
      })

      expect(rs.mocked(selectKey)).not.toHaveBeenCalled()
    })

    test('prints multiple schema URLs per entry', async () => {
      const writeSpy = rs.spyOn(process.stdout, 'write').mockReturnValue(true)
      const onPrint = rs.fn()

      await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo', 'bar'],
        schema: url => ({
          schemaA: `schemaA://${url}`,
          schemaB: `schemaB://${url}`,
        }),
        port: 3000,
        onPrint,
      })

      expect(writeSpy).toHaveBeenCalledTimes(1)
      const output = writeSpy.mock.calls[0]![0] as string
      expect(output).toContain('schemaA://https://example.com/foo.lynx.bundle')
      expect(output).toContain('schemaB://https://example.com/foo.lynx.bundle')
      expect(output).toContain('schemaA://https://example.com/bar.lynx.bundle')
      expect(output).toContain('schemaB://https://example.com/bar.lynx.bundle')
      expect(onPrint).toHaveBeenCalledTimes(4)
      writeSpy.mockRestore()
    })
  })

  test('open page', async () => {
    rs.stubEnv('NODE_ENV', 'development')
    const onPrint = rs.fn()
    const onOpen = rs.fn()

    const { selectKey, isCancel } = await import('@clack/prompts')
    let i = 0
    rs.mocked(selectKey).mockImplementation(() => {
      i++
      if (i === 1) {
        return Promise.resolve('o')
      } else if (i === 2) {
        return new Promise(rs.fn())
      }
      expect.fail('should not call selectKey 3 times')
    })
    rs.mocked(isCancel).mockReturnValue(false)

    const unregister = await registerConsoleShortcuts({
      api: mockedRsbuildAPI,
      entries: ['foo', 'bar'],
      schema: i => i,
      port: 3000,
      customShortcuts: {
        o: { value: 'o', label: 'Open Page', action: onOpen },
      },
      onPrint,
    })

    expect(onPrint).toBeCalledWith('https://example.com/foo.lynx.bundle')
    await expect.poll(() => selectKey).toBeCalledTimes(2)
    expect(onPrint).toBeCalledTimes(2)

    expect(onOpen).toBeCalledTimes(1)
    unregister()
  })

  describe('showQRCode option', () => {
    test('renders the QR block by default', async () => {
      const { log, selectKey } = await import('@clack/prompts')
      rs.mocked(log.success).mockClear()
      // Park the interactive loop so log.success is only called by the initial print.
      rs.mocked(selectKey).mockReset().mockImplementation(() =>
        new Promise(rs.fn())
      )

      const unregister = await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
      })

      expect(rs.mocked(log.success).mock.calls.length).toBeGreaterThanOrEqual(1)
      unregister()
    })

    test('skips the QR block when showQRCode is false', async () => {
      const { log, selectKey } = await import('@clack/prompts')
      rs.mocked(log.success).mockClear()
      rs.mocked(selectKey).mockReset().mockImplementation(() =>
        new Promise(rs.fn())
      )
      const onPrint = rs.fn()

      const unregister = await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
        showQRCode: false,
        onPrint,
      })

      expect(rs.mocked(log.success)).not.toHaveBeenCalled()
      // URL is still surfaced through onPrint.
      expect(onPrint).toHaveBeenCalledWith(
        'https://example.com/foo.lynx.bundle',
      )
      unregister()
    })
  })
})
