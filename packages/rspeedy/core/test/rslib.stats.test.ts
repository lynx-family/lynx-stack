// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import type { MultiCompilerStatsJson } from '../rslib.stats.js'
import { toSingleCompilerStats } from '../rslib.stats.js'

describe('toSingleCompilerStats', () => {
  test('returns single-compiler stats unchanged', () => {
    const stats = {
      hash: 'abc',
      assets: [{ name: 'index.js', size: 100 }],
      chunks: [],
      modules: [],
    } satisfies MultiCompilerStatsJson

    expect(toSingleCompilerStats(stats)).toBe(stats)
  })

  test('returns stats unchanged when children is empty', () => {
    const stats = { children: [] } satisfies MultiCompilerStatsJson

    expect(toSingleCompilerStats(stats)).toBe(stats)
  })

  test('flattens multi-compiler stats into single-compiler stats', () => {
    const stats: MultiCompilerStatsJson = {
      hash: 'multi',
      errors: [],
      warnings: [],
      errorsCount: 0,
      warningsCount: 0,
      children: [
        {
          name: 'esm0',
          hash: 'child0',
          assets: [{ name: 'index.js', size: 100 }],
          chunks: [{ id: 0 }],
          modules: [{ name: './src/index.js' }],
          assetsByChunkName: { index: ['index.js'] },
          entrypoints: { index: { name: 'index' } },
          namedChunkGroups: { index: { name: 'index' } },
          errors: [],
          warnings: ['w0'],
          errorsCount: 0,
          warningsCount: 1,
        },
        {
          name: 'esm1',
          assets: [{ name: 'cli/main.js', size: 200 }],
          chunks: [{ id: 1 }],
          modules: [{ name: './src/cli/main.js' }],
          assetsByChunkName: { 'cli/main': ['cli/main.js'] },
          entrypoints: { 'cli/main': { name: 'cli/main' } },
          namedChunkGroups: { 'cli/main': { name: 'cli/main' } },
          errors: ['e1'],
          warnings: [],
          errorsCount: 1,
          warningsCount: 0,
        },
      ],
    }

    const result = toSingleCompilerStats(stats)

    // Top-level `children`/`name` must be gone so RelativeCI's webpack stats
    // extractor accepts it as a single-compiler stats.
    expect(result).not.toHaveProperty('children')
    expect(result).not.toHaveProperty('name')

    // Every child's assets/chunks/modules are merged and kept.
    expect(result.assets).toEqual([
      { name: 'index.js', size: 100 },
      { name: 'cli/main.js', size: 200 },
    ])
    expect(result.chunks).toEqual([{ id: 0 }, { id: 1 }])
    expect(result.modules).toEqual([
      { name: './src/index.js' },
      { name: './src/cli/main.js' },
    ])

    // Keyed maps are merged.
    expect(result.assetsByChunkName).toEqual({
      'index': ['index.js'],
      'cli/main': ['cli/main.js'],
    })
    expect(result.entrypoints).toEqual({
      'index': { name: 'index' },
      'cli/main': { name: 'cli/main' },
    })
    expect(result.namedChunkGroups).toEqual({
      'index': { name: 'index' },
      'cli/main': { name: 'cli/main' },
    })

    // Diagnostics are aggregated.
    expect(result.errors).toEqual(['e1'])
    expect(result.warnings).toEqual(['w0'])
    expect(result.errorsCount).toBe(1)
    expect(result.warningsCount).toBe(1)

    // Non-list fields inherit from the first child.
    expect(result['hash']).toBe('child0')
  })

  test('tolerates children missing optional fields', () => {
    const stats: MultiCompilerStatsJson = {
      children: [{ name: 'esm0' }, { name: 'esm1' }],
    }

    const result = toSingleCompilerStats(stats)

    expect(result.assets).toEqual([])
    expect(result.chunks).toEqual([])
    expect(result.modules).toEqual([])
    expect(result.errorsCount).toBe(0)
    expect(result.warningsCount).toBe(0)
    expect(result).not.toHaveProperty('children')
    expect(result).not.toHaveProperty('name')
  })
})
