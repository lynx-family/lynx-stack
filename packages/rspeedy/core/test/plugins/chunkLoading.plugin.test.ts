// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Plugins - chunkLoading', () => {
  test('Rspack defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.chunkLoading).toBe('lynx')
    expect(config.output?.chunkFormat).toBe('commonjs')
    expect(
      config.plugins?.some(plugin =>
        plugin && plugin.constructor.name === 'ChunkLoadingWebpackPlugin'
      ),
    ).toBeTruthy()
  })

  test('Webpack defaults', async () => {
    const { webpackProvider } = await import('@rsbuild/webpack')
    const rspeedy = await createStubRspeedy({
      provider: webpackProvider,
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.output?.chunkLoading).toBe('lynx')
    expect(config.output?.chunkFormat).toBe('commonjs')
    expect(
      config.plugins?.some(plugin =>
        plugin && plugin.constructor.name === 'ChunkLoadingWebpackPlugin'
      ),
    ).toBeTruthy()
  })

  describe('Web', () => {
    test('Rspack', async () => {
      const rspeedy = await createStubRspeedy({
        environments: {
          web: {},
        },
      })

      const config = await rspeedy.unwrapConfig()

      expect(config.output?.chunkLoading).toBe('import-scripts')
      expect(config.output?.chunkFormat).not.toBe('commonjs')
      expect(config.output?.iife).not.toBe(false)
    })

    test('Webpack', async () => {
      const { webpackProvider } = await import('@rsbuild/webpack')
      const rspeedy = await createStubRspeedy({
        provider: webpackProvider,
        environments: {
          web: {},
        },
      })

      const config = await rspeedy.unwrapConfig()

      expect(config.output?.chunkLoading).toBe('import-scripts')
      expect(config.output?.chunkFormat).not.toBe('commonjs')
      expect(config.output?.iife).not.toBe(false)
    })

    test('multiple environments', async () => {
      const rspeedy = await createStubRspeedy({
        environments: {
          web: {},
          lynx: {},
        },
      })

      const [webConfig, lynxConfig] = await rspeedy.initConfigs()

      expect(webConfig?.output?.chunkLoading).toBe('import-scripts')
      expect(webConfig?.output?.chunkFormat).not.toBe('commonjs')
      expect(webConfig?.output?.iife).not.toBe(false)

      expect(lynxConfig?.output?.chunkLoading).toBe('lynx')
      expect(lynxConfig?.output?.chunkFormat).toBe('commonjs')
      expect(lynxConfig?.output?.iife).toBe(false)
    })

    test('override with tools.rspack.output.chunkLoading', async () => {
      const rspeedy = await createStubRspeedy({
        environments: {
          web: {
            tools: {
              rspack: { output: { chunkLoading: 'import' } },
            },
          },
        },
      })

      const config = await rspeedy.unwrapConfig()

      expect(config.output?.chunkLoading).toBe('import')
    })
  })
})
