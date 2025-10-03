// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { registerConsoleShortcuts } from '../src/shortcuts.js'

vi.mock('@clack/prompts')

describe('PluginQRCode - CLI Shortcuts', () => {
  const mockedRsbuildAPI = {
    getNormalizedConfig: vi.fn().mockReturnValue({
      dev: { assetPrefix: 'https://example.com/' },
    }),
    useExposed: vi.fn().mockReturnValue({
      config: { filename: '[name].[platform].bundle' },
    }),
  } as unknown as RsbuildPluginAPI

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
      entries: {
        all: ['foo', 'bar'],
        lynx: ['foo', 'bar'],
        web: [],
      },
      schema: i => i,
      port: 3000,
      customShortcuts: {
        o: { value: 'o', label: 'Open Page', action: onOpen },
      },
      onPrint,
    })

    expect(onPrint).toBeCalledWith(
      'https://example.com/foo.lynx.bundle',
      undefined,
    )
    await expect.poll(() => selectKey).toBeCalledTimes(2)
    expect(onPrint).toBeCalledTimes(2)

    expect(onOpen).toBeCalledTimes(1)
    unregister()
  })
})
