// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

const findCssExtractFilename = (plugins: unknown[] | undefined) => {
  const plugin = plugins?.find(
    (p): p is { options: { filename?: string } } =>
      typeof p === 'object' && p !== null
      && (p as { constructor?: { name?: string } }).constructor?.name
        === 'CssExtractRspackPlugin',
  )
  return plugin?.options.filename
}

describe('pluginOutput', () => {
  test('should emit CSS into the intermediate directory', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(findCssExtractFilename(config.plugins)).toBe(
      '.lynx/[name]/[name].css',
    )
  })

  test('should keep a user-set distPath.css', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: {
        distPath: { css: 'custom-css' },
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(findCssExtractFilename(config.plugins)).toBe(
      'custom-css/[name]/[name].css',
    )
  })

  test('should keep a user-set filename.css', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: {
        filename: { css: 'style.css' },
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(findCssExtractFilename(config.plugins)).toBe('.lynx/style.css')
  })

  test('lowers const/let to var via output.environment', async () => {
    const rsbuild = await createStubRsbuild()
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(config.output?.environment?.const).toBe(false)
  })

  test('does not emit HTML', async () => {
    const rsbuild = await createStubRsbuild()
    await rsbuild.unwrapConfig()

    expect(rsbuild.getNormalizedConfig().tools?.htmlPlugin).toBe(false)
  })

  test('user can opt out of const/let lowering', async () => {
    const rsbuild = await createStubRsbuild({
      tools: {
        rspack: {
          output: { environment: { const: true } },
        },
      },
    })
    const config = await rsbuild.unwrapConfig({ action: 'build' })

    expect(config.output?.environment?.const).toBe(true)
  })

  test('honors output.filename.css set on an environment', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      environments: {
        lynx: { output: { filename: { css: 'lynx-[name].css' } } },
        web: { output: { filename: { css: 'web-[name].css' } } },
      },
    })
    const [lynx, web] = await rsbuild.initConfigs({ action: 'build' })
    expect(findCssExtractFilename(lynx?.plugins)).toBe('.lynx/lynx-[name].css')
    expect(findCssExtractFilename(web?.plugins)).toBe('.lynx/web-[name].css')
  })

  test('prefers output.distPath.css of the environment over the root', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      output: { distPath: { css: 'root-css' } },
      environments: {
        lynx: { output: { distPath: { css: 'lynx-css' } } },
        web: {},
      },
    })
    const [lynx, web] = await rsbuild.initConfigs({ action: 'build' })
    expect(findCssExtractFilename(lynx?.plugins)).toBe(
      'lynx-css/[name]/[name].css',
    )
    expect(findCssExtractFilename(web?.plugins)).toBe(
      'root-css/[name]/[name].css',
    )
  })

  test('honors output.legalComments set on an environment', async () => {
    const rsbuild = await createStubRsbuild({
      environments: {
        lynx: { output: { legalComments: 'inline' } },
        web: {},
      },
    })
    await rsbuild.initConfigs()
    expect(
      rsbuild.getNormalizedConfig({ environment: 'lynx' }).output.legalComments,
    ).toBe('inline')
    expect(
      rsbuild.getNormalizedConfig({ environment: 'web' }).output.legalComments,
    ).toBe('none')
  })
})
