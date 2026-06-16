// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { pluginReactLynx } from '../src/pluginReactLynx.js'

describe('config plugin', () => {
  test('use targetSdkVersion from pluginLynxConfig', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginLynxConfig({
            targetSdkVersion: '3.4',
          }),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [config] = await rspeedy.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.targetSdkVersion).toBe('3.4')
  })

  test('use configs from pluginLynxConfig', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginLynxConfig({
            enableCSSSelector: false,
          }),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [config] = await rspeedy.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.enableCSSSelector).toBe(false)
  })

  test('config in pluginLynxConfig should override user options', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx({
            enableCSSSelector: true,
          }),
          pluginLynxConfig({
            enableCSSSelector: false,
          }),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [config] = await rspeedy.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.enableCSSSelector).toBe(false)
  })

  test('should not throw when having extra config in pluginLynxConfig', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
          pluginLynxConfig({
            defaultOverflowVisible: false,
          }),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    await expect(rspeedy.initConfigs()).resolves.toHaveLength(1)
  })

  test('output.filename.bundle as a string keeps the lazy bundle default', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        output: {
          filename: {
            bundle: '[name].[platform].bundle',
          },
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [config] = await rspeedy.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    // The string form is resolved as before.
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.filename).toBe('main.lynx.bundle')

    // The string form does not override `lazyBundleFilename`, so
    // `LynxTemplatePlugin` keeps its default (`async/[name].[fullhash].bundle`).
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.lazyBundleFilename).toBeUndefined()
  })

  test('output.filename.bundle as a function controls main and lazy bundles', async () => {
    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: './fixtures/basic.tsx',
          },
        },
        output: {
          filename: {
            bundle: ({ lazyBundle, platform }) =>
              lazyBundle
                ? `my-lazy-bundles/[name].[fullhash].bundle`
                : `[name].${platform}.bundle`,
          },
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
    })

    const [config] = await rspeedy.initConfigs()

    const templatePlugin = config?.plugins?.find((
      p,
    ): p is LynxTemplatePlugin => p?.constructor.name === 'LynxTemplatePlugin')

    // The main bundle uses `lazyBundle: false`, with `[name]`/`[platform]`
    // resolved to the entry name and the environment name.
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.filename).toBe('main.lynx.bundle')

    // The lazy bundles use `lazyBundle: true`. `[name]` is kept for
    // `LynxTemplatePlugin` to resolve per async chunk.
    // @ts-expect-error private field
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(templatePlugin?.options.lazyBundleFilename).toBe(
      'my-lazy-bundles/[name].[fullhash].bundle',
    )
  })
})
