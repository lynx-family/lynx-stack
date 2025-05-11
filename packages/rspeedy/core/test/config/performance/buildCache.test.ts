// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { createRspeedy } from '../../../src/create-rspeedy.js'
import { createStubRspeedy } from '../../createStubRspeedy.js'

describe('buildCache', () => {
  test('default', async () => {
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.experiments?.cache).toBeFalsy()
  })

  test('buildCache: true', async () => {
    const rspeedy = await createStubRspeedy({
      performance: { buildCache: true },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.experiments?.cache).toStrictEqual(
      expect.objectContaining({
        type: 'persistent',
        version: 'lynx-test',
      }),
    )
  })

  test('buildCache: false', async () => {
    const rspeedy = await createStubRspeedy({
      performance: { buildCache: false },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.experiments?.cache).toBeFalsy()
  })

  test('buildCache.buildDependencies', async () => {
    const rspeedy = await createStubRspeedy({
      performance: {
        buildCache: { buildDependencies: ['foo.txt'] },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.experiments?.cache).toStrictEqual(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        buildDependencies: expect.arrayContaining(['foo.txt']),
      }),
    )
  })

  test('buildCache.cacheDigest', async () => {
    const rspeedy = await createStubRspeedy({
      performance: {
        buildCache: {
          cacheDigest: ['foo', 'bar', undefined],
        },
      },
    })

    const config = await rspeedy.unwrapConfig()

    expect(config.experiments?.cache).toStrictEqual(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        version: expect.stringMatching('lynx-test-'),
      }),
    )
  })

  test('with .env', async () => {
    const cwd = path.resolve(
      fileURLToPath(import.meta.url),
      '../../../cli/fixtures/project-with-env',
    )
    const rspeedy = await createRspeedy({
      cwd,
      rspeedyConfig: {
        performance: {
          buildCache: true,
        },
      },
      loadEnv: true,
    })

    const [config] = await rspeedy.initConfigs()

    expect(config?.experiments?.cache).toStrictEqual(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        buildDependencies: expect.arrayContaining([
          path.resolve(cwd, '.env'),
          path.resolve(cwd, '.env.test'),
        ]),
      }),
    )
  })
})
