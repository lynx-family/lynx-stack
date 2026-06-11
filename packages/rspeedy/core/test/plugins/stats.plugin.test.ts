// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { getBundleStatsJson } from '../../src/plugins/statsJsonOptions.js'
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

      expect(statsJson.children).toBeUndefined()
      expect(statsJson.name).toBe('lynx')
      expect(statsJson.assets).toEqual(expect.any(Array))
      expect(statsJson.chunks).toEqual(expect.any(Array))
      expect(statsJson.modules).toEqual(expect.any(Array))
      expect(statsJson.entrypoints).toEqual(expect.any(Object))
      expect(statsJson.namedChunkGroups).toEqual(expect.any(Object))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('selects the lynx child from multi-compiler stats output', () => {
    const webStats = {
      name: 'web',
      assets: ['web.js'],
      chunks: ['web'],
      modules: ['web-module'],
      entrypoints: { main: {} },
      namedChunkGroups: { main: {} },
    }
    const lynxStats = {
      name: 'lynx',
      assets: ['main.lynx.bundle'],
      chunks: ['lynx'],
      modules: ['lynx-module'],
      entrypoints: { main: {} },
      namedChunkGroups: { main: {} },
    }

    expect(getBundleStatsJson({
      children: [webStats, lynxStats],
    })).toBe(lynxStats)
  })

  test('selects the first child when multi-compiler stats has no lynx child', () => {
    const esmStats = {
      name: 'esm0',
      assets: ['index.js'],
      chunks: ['index'],
      modules: ['module'],
      entrypoints: { index: {} },
      namedChunkGroups: { index: {} },
    }
    const cjsStats = {
      name: 'cjs',
      assets: ['index.cjs'],
      chunks: ['index'],
      modules: ['module'],
      entrypoints: { index: {} },
      namedChunkGroups: { index: {} },
    }

    expect(getBundleStatsJson({
      children: [esmStats, cjsStats],
    })).toBe(esmStats)
  })

  test('omits an empty children array from the emitted stats object', () => {
    expect(getBundleStatsJson({
      name: 'lynx',
      assets: [],
      chunks: [],
      modules: [],
      entrypoints: {},
      namedChunkGroups: {},
      children: [],
    })).toEqual({
      name: 'lynx',
      assets: [],
      chunks: [],
      modules: [],
      entrypoints: {},
      namedChunkGroups: {},
    })
  })
})
