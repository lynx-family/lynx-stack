// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'

describe('pluginChunkLoading', () => {
  test('Rspack defaults', async () => {
    const rsbuild = await createStubRsbuild()
    const config = await rsbuild.unwrapConfig()

    expect(config.output?.chunkLoading).toBe('lynx')
    expect(config.output?.chunkFormat).toBe('commonjs')

    const pluginNames = config.plugins?.map((plugin) =>
      plugin?.constructor.name
    )
    expect(pluginNames).toContain('ChunkLoadingWebpackPlugin')
    expect(pluginNames).toContain('LynxCacheEventsPlugin')
  })

  describe('Web', () => {
    test('Rspack', async () => {
      const rsbuild = await createStubRsbuild({
        environments: {
          web: {},
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.chunkFormat).toBe('commonjs')
      expect(config.output?.iife).not.toBe(false)
    })

    test('multiple environments', async () => {
      const rsbuild = await createStubRsbuild({
        environments: {
          web: {},
          lynx: {},
        },
      })

      const [webConfig, lynxConfig] = await rsbuild.initConfigs()

      expect(webConfig?.output?.chunkFormat).toBe('commonjs')
      expect(webConfig?.output?.iife).not.toBe(false)

      expect(lynxConfig?.output?.chunkLoading).toBe('lynx')
      expect(lynxConfig?.output?.chunkFormat).toBe('commonjs')
    })

    test('override with tools.rspack.output.chunkLoading', async () => {
      const rsbuild = await createStubRsbuild({
        environments: {
          web: {
            tools: {
              rspack: { output: { chunkLoading: 'import' } },
            },
          },
        },
      })

      const config = await rsbuild.unwrapConfig()

      expect(config.output?.chunkLoading).toBe('import')
    })
  })
})
