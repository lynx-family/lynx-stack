// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import type { LynxConfig } from '@lynx-js/rsbuild-plugin'

import { registerConsoleShortcuts } from '../src/shortcuts.js'

vi.mock('@clack/prompts')

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
    getNormalizedConfig: vi.fn().mockReturnValue({
      dev: { assetPrefix: 'https://example.com/' },
    }),
    useExposed: vi.fn().mockReturnValue(createLynxConfig()),
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
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

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
      const onPrint = vi.fn()

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

      expect(vi.mocked(selectKey)).not.toHaveBeenCalled()
    })

    test('prints multiple schema URLs per entry', async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
      const onPrint = vi.fn()

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
    vi.stubEnv('NODE_ENV', 'development')
    const onPrint = vi.fn()
    const onOpen = vi.fn()

    const { selectKey, isCancel } = await import('@clack/prompts')
    let i = 0
    vi.mocked(selectKey).mockImplementation(() => {
      i++
      if (i === 1) {
        return Promise.resolve('o')
      } else if (i === 2) {
        return new Promise(vi.fn())
      }
      expect.fail('should not call selectKey 3 times')
    })
    vi.mocked(isCancel).mockReturnValue(false)

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

  describe('dev server restart', () => {
    // The reader loop is process-wide state; start each test from a fresh
    // module so a loop parked by an earlier test cannot serve these.
    let register: typeof registerConsoleShortcuts
    beforeEach(async () => {
      vi.resetModules()
      ;({ registerConsoleShortcuts: register } = await import(
        '../src/shortcuts.js'
      ))
    })

    test('hands the pending prompt over to the registration that replaces it', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { select, selectKey, isCancel, log } = await import(
        '@clack/prompts'
      )
      vi.mocked(isCancel).mockReturnValue(false)
      vi.mocked(log.success).mockClear()

      let pressKey!: (key: string) => void
      vi.mocked(selectKey)
        .mockReset()
        .mockImplementationOnce(() =>
          new Promise<string>(resolve => {
            pressKey = resolve
          })
        )
        .mockImplementation(() => new Promise(vi.fn()))
      vi.mocked(select).mockReset().mockResolvedValue('bar')

      const unregister = await register({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
      })
      await expect.poll(() => selectKey).toHaveBeenCalledTimes(1)

      // The dev server restarts while the prompt is still waiting for a key.
      unregister()
      const unregisterReplacement = await register({
        api: mockedRsbuildAPI,
        entries: ['bar', 'baz'],
        schema: i => i,
        port: 4000,
      })

      // No second prompt competes with the pending one.
      expect(selectKey).toHaveBeenCalledTimes(1)
      vi.mocked(log.success).mockClear()

      pressKey('r')

      // The key is served for the replacement: its entries are offered and
      // its QR code is printed.
      await expect.poll(() => select).toHaveBeenCalledTimes(1)
      expect(vi.mocked(select).mock.calls[0]![0]).toMatchObject({
        options: [
          expect.objectContaining({ value: 'bar' }),
          expect.objectContaining({ value: 'baz' }),
        ],
      })
      await expect.poll(() => log.success).toHaveBeenCalled()
      const printed = vi.mocked(log.success).mock.calls.map(call =>
        String(call[0])
      )
      expect(printed).toContainEqual(
        expect.stringContaining('https://example.com/bar.lynx.bundle'),
      )
      expect(printed).not.toContainEqual(
        expect.stringContaining('https://example.com/foo.lynx.bundle'),
      )

      unregisterReplacement()
    })

    test('stops prompting once the dev server closes for good', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { select, selectKey, isCancel } = await import('@clack/prompts')
      vi.mocked(isCancel).mockReturnValue(false)

      let pressKey!: (key: string) => void
      vi.mocked(selectKey)
        .mockReset()
        .mockImplementationOnce(() =>
          new Promise<string>(resolve => {
            pressKey = resolve
          })
        )
        .mockImplementation(() => new Promise(vi.fn()))
      vi.mocked(select).mockReset()

      const unregister = await register({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
      })
      await expect.poll(() => selectKey).toHaveBeenCalledTimes(1)

      unregister()
      pressKey('r')
      await new Promise(resolve => setTimeout(resolve, 20))

      // Nothing to act for: no entry prompt, no new key prompt, no exit.
      expect(select).not.toHaveBeenCalled()
      expect(selectKey).toHaveBeenCalledTimes(1)
    })
  })

  describe('showQRCode option', () => {
    test('renders the QR block by default', async () => {
      const { log, selectKey } = await import('@clack/prompts')
      vi.mocked(log.success).mockClear()
      // Park the interactive loop so log.success is only called by the initial print.
      vi.mocked(selectKey).mockReset().mockImplementation(() =>
        new Promise(vi.fn())
      )

      const unregister = await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
      })

      expect(vi.mocked(log.success).mock.calls.length).toBeGreaterThanOrEqual(1)
      unregister()
    })

    test('skips the QR block when showQRCode is false', async () => {
      const { log, selectKey } = await import('@clack/prompts')
      vi.mocked(log.success).mockClear()
      vi.mocked(selectKey).mockReset().mockImplementation(() =>
        new Promise(vi.fn())
      )
      const onPrint = vi.fn()

      const unregister = await registerConsoleShortcuts({
        api: mockedRsbuildAPI,
        entries: ['foo'],
        schema: i => i,
        port: 3000,
        showQRCode: false,
        onPrint,
      })

      expect(vi.mocked(log.success)).not.toHaveBeenCalled()
      // URL is still surfaced through onPrint.
      expect(onPrint).toHaveBeenCalledWith(
        'https://example.com/foo.lynx.bundle',
      )
      unregister()
    })
  })
})
