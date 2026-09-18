// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { createStubRspeedy } from '../../createStubRspeedy.js'

const pluginAssetPrefix = {
  name: 'test:asset-prefix',
  setup(api) {
    api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
      mergeRsbuildConfig(config, { dev: { assetPrefix: 'http://my-cdn/' } })
    )
  },
} satisfies RsbuildPlugin

describe('dev.assetPrefix', () => {
  test('defaults to the dev server address', async () => {
    const rspeedy = await createStubRspeedy({ mode: 'development' })

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.publicPath).toMatch(/^http:\/\/.+:3000\/$/)
  })

  test('keeps a value set by a plugin', async () => {
    const rspeedy = await createStubRspeedy({
      mode: 'development',
      plugins: [pluginAssetPrefix],
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.publicPath).toBe('http://my-cdn/')
  })

  test('a plugin wins over the config', async () => {
    const rspeedy = await createStubRspeedy({
      mode: 'development',
      dev: { assetPrefix: 'http://from-config/' },
      plugins: [pluginAssetPrefix],
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.publicPath).toBe('http://my-cdn/')
  })

  test('server.base does not count as a plugin-set value', async () => {
    const rspeedy = await createStubRspeedy({
      mode: 'development',
      server: { base: '/sub' },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.publicPath).toMatch(/^http:\/\/.+:3000\/sub\/$/)
  })
})
