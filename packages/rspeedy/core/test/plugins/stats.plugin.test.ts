// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy } from '../createStubRspeedy.js'

interface StatsJson {
  name?: string
  assets?: unknown
  chunks?: unknown
  modules?: unknown
  entrypoints?: unknown
  namedChunkGroups?: unknown
  children?: StatsJson[]
}

describe('stats plugin', () => {
  test('no DEBUG', async () => {
    rstest.stubEnv('DEBUG', '')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBeUndefined()
  })

  test('DEBUG', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(true)
  })

  test('override performance.profile', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({
      performance: { profile: false },
    })

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(false)
  })

  test('emits complete stats.json when performance.profile is enabled', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'rspeedy-stats-json-'))

    try {
      await mkdir(path.join(root, 'src'))
      await writeFile(
        path.join(root, 'src/index.js'),
        'import "./message.js";\nconsole.info("hello stats");\n',
      )
      await writeFile(
        path.join(root, 'src/message.js'),
        'export const message = "hello";\n',
      )

      const rspeedy = await createStubRspeedy({
        environments: {
          web: {},
          lynx: {},
        },
        performance: { profile: true },
      }, root)

      const result = await rspeedy.build()
      await result.close()

      const statsJson = JSON.parse(
        await readFile(path.join(root, 'dist/stats.json'), 'utf-8'),
      ) as StatsJson

      expect(statsJson.children?.map(child => child.name)).toEqual([
        'web',
        'lynx',
      ])
      expect(statsJson.children?.[0]?.assets).toEqual(expect.any(Array))
      expect(statsJson.children?.[0]?.chunks).toEqual(expect.any(Array))
      expect(statsJson.children?.[0]?.modules).toEqual(expect.any(Array))
      expect(statsJson.children?.[0]?.entrypoints).toEqual(expect.any(Object))
      expect(statsJson.children?.[0]?.namedChunkGroups).toEqual(
        expect.any(Object),
      )
      expect(statsJson.children?.[1]?.assets).toEqual(expect.any(Array))
      expect(statsJson.children?.[1]?.chunks).toEqual(expect.any(Array))
      expect(statsJson.children?.[1]?.modules).toEqual(expect.any(Array))
      expect(statsJson.children?.[1]?.entrypoints).toEqual(expect.any(Object))
      expect(statsJson.children?.[1]?.namedChunkGroups).toEqual(
        expect.any(Object),
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
