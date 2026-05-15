// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { collectEntryPathMap, dedupe } from '../src/collectors/entries.js'

describe('collectEntryPathMap', () => {
  const cwd = '/repo/packages/example'
  const repoRoot = '/repo'

  test('string entry becomes a single-element array, relative to repoRoot', () => {
    const map = collectEntryPathMap(
      { main: 'src/index.ts' },
      cwd,
      repoRoot,
    )
    expect(map).toEqual({ main: ['packages/example/src/index.ts'] })
  })

  test('array entry preserves order', () => {
    const map = collectEntryPathMap(
      { main: ['src/a.ts', 'src/b.ts'] },
      cwd,
      repoRoot,
    )
    expect(map).toEqual({
      main: ['packages/example/src/a.ts', 'packages/example/src/b.ts'],
    })
  })

  test('object entry with `import: string`', () => {
    const map = collectEntryPathMap(
      { main: { import: 'src/index.ts' } },
      cwd,
      repoRoot,
    )
    expect(map).toEqual({ main: ['packages/example/src/index.ts'] })
  })

  test('object entry with `import: string[]`', () => {
    const map = collectEntryPathMap(
      { main: { import: ['src/a.ts', 'src/b.ts'] } },
      cwd,
      repoRoot,
    )
    expect(map.main).toEqual([
      'packages/example/src/a.ts',
      'packages/example/src/b.ts',
    ])
  })

  test('object entry without an `import` key yields []', () => {
    const map = collectEntryPathMap(
      { main: { description: 'foo' } as unknown as { import: string } },
      cwd,
      repoRoot,
    )
    expect(map).toEqual({ main: [] })
  })

  test('falls back to cwd when repoRoot is null', () => {
    const map = collectEntryPathMap({ main: 'src/index.ts' }, cwd, null)
    expect(map.main).toEqual(['src/index.ts'])
  })

  test('handles multiple entries independently', () => {
    const map = collectEntryPathMap(
      { main: 'src/a.ts', other: 'src/b.ts' },
      cwd,
      repoRoot,
    )
    expect(Object.keys(map).sort()).toEqual(['main', 'other'])
  })
})

describe('dedupe', () => {
  test('preserves first-seen order', () => {
    expect(dedupe(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  test('returns a new array (does not mutate input)', () => {
    const input = ['a', 'b', 'a']
    const output = dedupe(input)
    expect(output).not.toBe(input)
    expect(input).toEqual(['a', 'b', 'a'])
  })

  test('empty input → empty output', () => {
    expect(dedupe([])).toEqual([])
  })

  test('dedupes by reference for object items', () => {
    const a = { id: 1 }
    const b = { id: 1 }
    expect(dedupe([a, a, b])).toEqual([a, b])
  })
})
