// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { beforeEach, describe, expect, rstest, test } from '@rstest/core'

import { registerConsoleShortcuts } from '../src/shortcuts.js'

rstest.mock('@clack/prompts', { spy: true })

describe('PluginQRCode - CLI Shortcuts', () => {
  const mockedRsbuildAPI = {
    getNormalizedConfig: rstest.fn().mockReturnValue({
      dev: { assetPrefix: 'https://example.com/' },
    }),
    useExposed: rstest.fn().mockReturnValue({
      config: { filename: '[name].[platform].bundle' },
    }),
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
      const writeSpy = rstest.spyOn(process.stdout, 'write').mockReturnValue(
        true,
      )

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
      const onPrint = rstest.fn()

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

      expect(rstest.mocked(selectKey)).not.toHaveBeenCalled()
    })

    test('prints multiple schema URLs per entry', async () => {
      const writeSpy = rstest.spyOn(process.stdout, 'write').mockReturnValue(
        true,
      )
      const onPrint = rstest.fn()

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
    rstest.stubEnv('NODE_ENV', 'development')
    const onPrint = rstest.fn()
    const onOpen = rstest.fn()

    const { selectKey, isCancel } = await import('@clack/prompts')
    let i = 0
    rstest.mocked(selectKey).mockImplementation(() => {
      i++
      if (i === 1) {
        return Promise.resolve('o')
      } else if (i === 2) {
        return new Promise(rstest.fn())
      }
      expect.fail('should not call selectKey 3 times')
    })
    rstest.mocked(isCancel).mockReturnValue(false)

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
})
