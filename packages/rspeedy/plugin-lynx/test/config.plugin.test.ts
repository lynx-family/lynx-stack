// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import {
  getLynxConfig,
  resolveBundleFilename,
  resolveLazyBundleFilename,
} from '../src/index.js'
import type { LynxConfig, LynxPluginOptions } from '../src/index.js'

async function usingLynxConfig(
  options?: LynxPluginOptions,
): Promise<LynxConfig> {
  let lynx: LynxConfig | undefined

  const rsbuild = await createStubRsbuild(
    {
      plugins: [{
        name: 'test:capture',
        setup(api: RsbuildPluginAPI) {
          lynx = getLynxConfig(api)
        },
      }],
    },
    undefined,
    options,
  )

  await rsbuild.initConfigs()

  return lynx!
}

describe('pluginConfig', () => {
  test('resolves the default bundle filename', async () => {
    const lynx = await usingLynxConfig()

    expect(resolveBundleFilename(lynx, {
      entryName: 'main',
      platform: 'lynx',
    })).toBe('main.lynx.bundle')
  })

  test('resolves a string bundle filename', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: '[name].[platform].custom.bundle' },
      },
    })

    expect(resolveBundleFilename(lynx, {
      entryName: 'main',
      platform: 'web',
    })).toBe('main.web.custom.bundle')
  })

  test('resolves a function bundle filename', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: {
          bundle: ({ lazyBundle, entryName, platform }) =>
            lazyBundle
              ? `lazy/[name].${platform}.bundle`
              : `from-function/${entryName!}.${platform}.bundle`,
        },
      },
    })

    expect(resolveBundleFilename(lynx, {
      entryName: 'main',
      platform: 'lynx',
    })).toBe('from-function/main.lynx.bundle')
  })

  test('keeps [name] for a lazy bundle, which has no entry name', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: () => 'lazy/[name].[platform].bundle' },
      },
    })

    expect(resolveLazyBundleFilename(lynx, { platform: 'lynx' }))
      .toBe('lazy/[name].lynx.bundle')
  })

  test('inserts the context values literally', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: '[name].[platform].bundle' },
      },
    })

    expect(resolveBundleFilename(lynx, {
      entryName: 'a$&b',
      platform: 'x$$y',
    })).toBe('a$&b.x$$y.bundle')
  })

  test('does not resolve placeholders inserted by other placeholders', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: '[name].[platform].bundle' },
      },
    })

    expect(resolveBundleFilename(lynx, {
      entryName: 'e[platform]',
      platform: 'p[name]',
    })).toBe('e[platform].p[name].bundle')
  })

  test('does not resolve a lazy bundle filename for a string', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: '[name].[platform].bundle' },
      },
    })

    expect(resolveLazyBundleFilename(lynx, {
      platform: 'lynx',
    })).toBeUndefined()
  })

  test('resolves a lazy bundle filename for a function', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: {
          bundle: ({ lazyBundle }) =>
            lazyBundle ? 'lazy/[name].[platform].bundle' : '[name].bundle',
        },
      },
    })

    expect(resolveLazyBundleFilename(lynx, {
      platform: 'lynx',
    })).toBe('lazy/[name].lynx.bundle')
  })

  test('falls back to the defaults when pluginLynx is not applied', async () => {
    let lynx: LynxConfig | undefined

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [{
          name: 'test:capture',
          setup(api: RsbuildPluginAPI) {
            lynx = getLynxConfig(api)
          },
        }],
      },
    })

    await rsbuild.initConfigs()

    expect(resolveBundleFilename(lynx!, {
      entryName: 'main',
      platform: 'lynx',
    })).toBe('main.lynx.bundle')
  })
})
