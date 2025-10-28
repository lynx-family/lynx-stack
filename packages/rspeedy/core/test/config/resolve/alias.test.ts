// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('Config - Resolve.alias', () => {
  test('defaults', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toMatchInlineSnapshot(`
      {
        "@swc/helpers": "<WORKSPACE>/node_modules/<PNPM_INNER>/@swc/helpers",
      }
    `)
  })

  test('resolve.alias with Record<string, string>', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        alias: {
          foo: 'bar',
          'foo$': 'baz',
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty('foo', 'bar')
    expect(config.resolve?.alias).toHaveProperty('foo$', 'baz')
  })

  test('resolve.alias with Record<string, string[]>', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        alias: {
          foo: ['bar'],
          'foo$': ['bar', 'baz'],
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty('foo', 'bar')
    expect(config.resolve?.alias).toHaveProperty('foo$', ['bar', 'baz'])
  })

  test('resolve.alias with Record<string, false>', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        alias: {
          foo: false,
          bar: false,
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty('foo', false)
    expect(config.resolve?.alias).toHaveProperty('bar', false)
  })

  test('resolve.alias with source.alias', async () => {
    const rspeedy = await createStubRspeedy({
      resolve: {
        alias: {
          foo: 'foo1',
          bar: ['bar1', 'bar2'],
          baz: false,
        },
      },
      source: {
        alias: {
          foo: 'foo2',
          bar: 'bar3',
          baz: 'baz',
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.resolve?.alias).toHaveProperty('foo', 'foo2')
    expect(config.resolve?.alias).toHaveProperty('bar', 'bar3')
    expect(config.resolve?.alias).toHaveProperty('baz', 'baz')
  })
})
