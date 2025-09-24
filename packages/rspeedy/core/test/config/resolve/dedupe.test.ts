// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('Config - Resolve.dedupe', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toMatchInlineSnapshot(`
      {
        "@swc/helpers": "<WORKSPACE>/node_modules/<PNPM_INNER>/@swc/helpers",
      }
    `)
  })

  test('resolve.dedupe with string[]', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        dedupe: ['@rsbuild/core'],
      },
    })
    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty(
      '@rsbuild/core',
      expect.stringContaining(`@rsbuild${path.sep}core`),
    )
  })

  test('resolve.dedupe with unresolved package', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        dedupe: ['foo', 'bar', 'baz'],
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).not.toHaveProperty('foo')
    expect(config.resolve?.alias).not.toHaveProperty('bar')
    expect(config.resolve?.alias).not.toHaveProperty('baz')
  })
})
