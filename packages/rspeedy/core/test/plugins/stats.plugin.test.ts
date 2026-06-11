// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

interface StatsJson {
  assets?: unknown
  chunks?: unknown
  modules?: unknown
  entrypoints?: unknown
  namedChunkGroups?: unknown
  children?: StatsJson[]
}

describe('stats plugin', () => {
  test('no DEBUG', async () => {
    vi.stubEnv('DEBUG', '')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBeUndefined()
  })

  test('DEBUG', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({})

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(true)
  })

  test('override performance.profile', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')
    const rspeedy = await createStubRspeedy({
      performance: { profile: false },
    })

    const config = rspeedy.getRspeedyConfig()

    expect(config.performance?.profile).toBe(false)
  })

  test('emits RelativeCI-compatible stats.json when performance.profile is enabled', async () => {
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
        performance: { profile: true },
      }, root)

      const result = await rspeedy.build()
      await result.close()

      const statsJson = JSON.parse(
        await readFile(path.join(root, 'dist/stats.json'), 'utf-8'),
      ) as StatsJson
      const compilations = statsJson.children?.length
        ? statsJson.children
        : [statsJson]

      expect(compilations.length).toBeGreaterThan(0)
      for (const compilation of compilations) {
        expect(compilation.assets).toEqual(expect.any(Array))
        expect(compilation.chunks).toEqual(expect.any(Array))
        expect(compilation.modules).toEqual(expect.any(Array))
        expect(compilation.entrypoints).toEqual(expect.any(Object))
        expect(compilation.namedChunkGroups).toEqual(expect.any(Object))
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
