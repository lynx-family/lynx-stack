// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import { getLynxConfig } from '../src/config.js'
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

    expect(lynx.resolveBundleFilename({
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

    expect(lynx.resolveBundleFilename({
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

    expect(lynx.resolveBundleFilename({
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

    expect(lynx.resolveLazyBundleFilename({ platform: 'lynx' }))
      .toBe('lazy/[name].lynx.bundle')
  })

  test('inserts the context values literally', async () => {
    const lynx = await usingLynxConfig({
      output: {
        filename: { bundle: '[name].[platform].bundle' },
      },
    })

    expect(lynx.resolveBundleFilename({
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

    expect(lynx.resolveBundleFilename({
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

    expect(lynx.resolveLazyBundleFilename({
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

    expect(lynx.resolveLazyBundleFilename({
      platform: 'lynx',
    })).toBe('lazy/[name].lynx.bundle')
  })

  test('resolveIntermediateDir defaults to .rspeedy', async () => {
    const lynx = await usingLynxConfig()

    expect(lynx.resolveIntermediateDir()).toBe('.rspeedy')
    expect(lynx.resolveIntermediateDir({ entryName: 'main' }))
      .toBe('.rspeedy/main')
  })

  test('resolveIntermediateDir uses output.distPath.intermediate', async () => {
    const lynx = await usingLynxConfig({
      output: { distPath: { intermediate: '.lynx' } },
    })

    expect(lynx.resolveIntermediateDir()).toBe('.lynx')
    expect(lynx.resolveIntermediateDir({ entryName: 'main' }))
      .toBe('.lynx/main')
  })

  test('throws when pluginLynx is not applied', async () => {
    let error: unknown

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [{
          name: 'test:capture',
          setup(api: RsbuildPluginAPI) {
            try {
              getLynxConfig(api)
            } catch (caught) {
              error = caught
            }
          },
        }],
      },
    })

    await rsbuild.initConfigs()

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('`pluginLynx` has to be applied')
  })
})
