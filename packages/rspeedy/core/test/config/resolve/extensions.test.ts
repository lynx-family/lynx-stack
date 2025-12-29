// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('Config - Resolve.extensions', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.extensions).toMatchInlineSnapshot(`
      [
        ".ts",
        ".tsx",
        ".mjs",
        ".js",
        ".jsx",
        ".json",
        ".cjs",
      ]
    `)
  })

  test('resolve.extensions with string[]', async () => {
    const customExtensions = ['.ts', '.tsx', '.js', '.json']
    const rspeedy = await createStubRspeedy({
      resolve: {
        extensions: customExtensions,
      },
    })
    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.extensions).toEqual([...customExtensions, '.cjs'])
  })

  test('resolve.extensions with empty array', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        extensions: [],
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.extensions).toEqual(['.cjs'])
  })

  test('tools.rspack.resolve.extensions with custom extensions', async () => {
    const rspeedy = await createStubRspeedy({
      tools: {
        rspack: {
          resolve: {
            extensions: ['.foo'],
          },
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.extensions).toEqual([
      '.ts',
      '.tsx',
      '.mjs',
      '.js',
      '.jsx',
      '.json',
      '.cjs',
      '.foo',
    ])
  })
})
