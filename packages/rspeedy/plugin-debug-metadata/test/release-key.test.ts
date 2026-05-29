// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import {
  computeChunkReleaseKey,
  computeReleaseKey,
} from '../src/release-banner.js'

/** A ChunkGraph stub whose modules report the given identifiers. */
function fakeChunkGraph(
  ...moduleIds: string[]
): Rspack.Compilation['chunkGraph'] {
  const modules = moduleIds.map((id) => ({ identifier: () => id }))
  return {
    getChunkModules: () => modules,
  } as unknown as Rspack.Compilation['chunkGraph']
}

function fakeChunk(over: Partial<Rspack.Chunk> = {}): Rspack.Chunk {
  return { name: 'main', hash: 'abc', runtime: 'main', ...over } as Rspack.Chunk
}

describe('computeReleaseKey', () => {
  test('is a 160-bit lowercase hex digest', () => {
    expect(computeReleaseKey('a', 'b')).toMatch(/^[0-9a-f]{40}$/)
  })

  test('is deterministic for the same parts', () => {
    expect(computeReleaseKey('a', 'b')).toBe(computeReleaseKey('a', 'b'))
  })

  test('parts are unambiguously separated (no concatenation collisions)', () => {
    // Without a separator, ['a','bc'] and ['ab','c'] would hash the same.
    expect(computeReleaseKey('a', 'bc')).not.toBe(computeReleaseKey('ab', 'c'))
  })
})

describe('computeChunkReleaseKey', () => {
  test('is a 160-bit lowercase hex digest', () => {
    expect(computeChunkReleaseKey(fakeChunkGraph('m1', 'm2'), fakeChunk()))
      .toMatch(/^[0-9a-f]{40}$/)
  })

  test('is deterministic for the same chunk + modules', () => {
    expect(computeChunkReleaseKey(fakeChunkGraph('m1', 'm2'), fakeChunk()))
      .toBe(computeChunkReleaseKey(fakeChunkGraph('m1', 'm2'), fakeChunk()))
  })

  test('different module set produces a different key (cross-app namespace)', () => {
    expect(computeChunkReleaseKey(fakeChunkGraph('app-a/m'), fakeChunk()))
      .not.toBe(computeChunkReleaseKey(fakeChunkGraph('app-b/m'), fakeChunk()))
  })

  test('module order does not affect the key (sorted)', () => {
    expect(computeChunkReleaseKey(fakeChunkGraph('m1', 'm2'), fakeChunk()))
      .toBe(computeChunkReleaseKey(fakeChunkGraph('m2', 'm1'), fakeChunk()))
  })

  test('different chunk hash produces a different key', () => {
    expect(
      computeChunkReleaseKey(fakeChunkGraph('m1'), fakeChunk({ hash: 'h1' })),
    ).not.toBe(
      computeChunkReleaseKey(fakeChunkGraph('m1'), fakeChunk({ hash: 'h2' })),
    )
  })
})
