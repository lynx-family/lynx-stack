// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import {
  collectEntryPathMap,
  collectLazyBundleEntryResources,
  dedupe,
} from '../src/collectors/entries.js'

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

/**
 * Build a fake compilation where chunkGroup `name` has `origins`
 * matching pre-built importer/block/dep wiring. `resolveTo` is a
 * dependency-instance → resource map.
 */
function fakeCompilation(args: {
  name: string
  origins: Array<{ blocks: Array<{ deps: unknown[] }> }>
  resolveTo: Map<unknown, string>
}): { compilation: Rspack.Compilation, cg: unknown } {
  const builtOrigins = args.origins.map(o => ({
    blocks: o.blocks.map(b => ({ dependencies: b.deps })),
  }))
  const allBlocks = builtOrigins.flatMap(o => o.blocks)
  const cg = {
    origins: builtOrigins.map(o => ({
      module: { blocks: o.blocks },
      request: './x.js',
    })),
  }
  const blockToCg = new Map<unknown, unknown>(
    allBlocks.map(b => [b, cg]),
  )
  const compilation = {
    namedChunkGroups: new Map([[args.name, cg]]),
    chunkGraph: {
      getBlockChunkGroup: (b: unknown) => blockToCg.get(b) ?? null,
    },
    moduleGraph: {
      getResolvedModule: (d: unknown) => {
        const resource = args.resolveTo.get(d)
        return resource ? { resource } : null
      },
    },
  } as unknown as Rspack.Compilation
  return { compilation, cg }
}

describe('collectLazyBundleEntryResources', () => {
  test('resolves a single dynamic import to its target resource', () => {
    const dep = { id: 'import-LazyComponent' }
    const { compilation } = fakeCompilation({
      name: 'LazyComponent.js-react__main-thread',
      origins: [{ blocks: [{ deps: [dep] }] }],
      resolveTo: new Map([[dep, '/abs/src/LazyComponent.tsx']]),
    })
    expect(
      collectLazyBundleEntryResources(
        compilation,
        'LazyComponent.js-react__main-thread',
      ),
    ).toEqual(['/abs/src/LazyComponent.tsx'])
  })

  test('skips blocks whose getBlockChunkGroup does not match the target', () => {
    const targetDep = { id: 'target' }
    const otherDep = { id: 'other' }
    const targetBlock = { dependencies: [targetDep] }
    const otherBlock = { dependencies: [otherDep] }
    const cg = { origins: [] as unknown[] }
    const otherCg = { origins: [] as unknown[] }
    const importer = { blocks: [otherBlock, targetBlock] }
    ;(cg as { origins: unknown[] }).origins = [{ module: importer }]
    const compilation = {
      namedChunkGroups: new Map([['name', cg]]),
      chunkGraph: {
        getBlockChunkGroup: (b: unknown) => b === targetBlock ? cg : otherCg,
      },
      moduleGraph: {
        getResolvedModule: (d: unknown) =>
          d === targetDep
            ? { resource: '/abs/target.tsx' }
            : { resource: '/abs/other.tsx' },
      },
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'name')).toEqual([
      '/abs/target.tsx',
    ])
  })

  test('dedupes when multiple origins resolve to the same module', () => {
    const dep = { id: 'shared' }
    const importer1 = { blocks: [{ dependencies: [dep] }] }
    const importer2 = { blocks: [{ dependencies: [dep] }] }
    const cg = {
      origins: [{ module: importer1 }, { module: importer2 }],
    }
    const allBlocks = [
      ...importer1.blocks,
      ...importer2.blocks,
    ] as unknown[]
    const compilation = {
      namedChunkGroups: new Map([['name', cg]]),
      chunkGraph: {
        getBlockChunkGroup: (b: unknown) => allBlocks.includes(b) ? cg : null,
      },
      moduleGraph: {
        getResolvedModule: () => ({ resource: '/abs/shared.tsx' }),
      },
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'name')).toEqual([
      '/abs/shared.tsx',
    ])
  })

  test('returns [] when the named chunkGroup does not exist', () => {
    const compilation = {
      namedChunkGroups: new Map(),
      chunkGraph: { getBlockChunkGroup: () => null },
      moduleGraph: { getResolvedModule: () => null },
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'missing')).toEqual([])
  })

  test('returns [] when getResolvedModule yields no resource', () => {
    const dep = { id: 'd' }
    const block = { dependencies: [dep] }
    const cg = { origins: [{ module: { blocks: [block] } }] }
    const compilation = {
      namedChunkGroups: new Map([['name', cg]]),
      chunkGraph: { getBlockChunkGroup: () => cg },
      moduleGraph: { getResolvedModule: () => null },
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'name')).toEqual([])
  })

  test('drops non-absolute resources (defensive guard against virtual modules)', () => {
    const dep = { id: 'd' }
    const block = { dependencies: [dep] }
    const cg = { origins: [{ module: { blocks: [block] } }] }
    const compilation = {
      namedChunkGroups: new Map([['name', cg]]),
      chunkGraph: { getBlockChunkGroup: () => cg },
      moduleGraph: {
        getResolvedModule: () => ({ resource: 'relative/x.tsx' }),
      },
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'name')).toEqual([])
  })

  test('returns [] when chunkGraph or moduleGraph is unavailable', () => {
    const cg = { origins: [{ module: { blocks: [] } }] }
    const compilation = {
      namedChunkGroups: new Map([['name', cg]]),
    } as unknown as Rspack.Compilation
    expect(collectLazyBundleEntryResources(compilation, 'name')).toEqual([])
  })

  test('returns [] for a plain entry origin that has no importer module', () => {
    const cg = {
      origins: [{ request: '/abs/src/background.ts', loc: 'card__background' }],
    }
    const compilation = {
      namedChunkGroups: new Map([['card__background', cg]]),
    } as unknown as Rspack.Compilation
    expect(
      collectLazyBundleEntryResources(compilation, 'card__background'),
    ).toEqual([])
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
