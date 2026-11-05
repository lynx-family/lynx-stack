// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import {
  UI_SOURCE_MAP_RECORDS_BUILD_INFO,
  remapUiTree,
} from '@lynx-js/debug-metadata'
import type {
  DebugMetadataAsset,
  UiSourceMapRecord,
} from '@lynx-js/debug-metadata'

import {
  collectUiSourceMapRecordsFromModule,
  compareUiSourceMapRecord,
  createUiSourceMap,
} from '../src/collectors/ui-source-map.js'

const record = (over: Partial<UiSourceMapRecord> = {}): UiSourceMapRecord => ({
  uiSourceMap: 0,
  filename: 'src/App.tsx',
  lineNumber: 1,
  columnNumber: 0,
  ...over,
})

describe('collectUiSourceMapRecordsFromModule', () => {
  test('reads records off `buildInfo[UI_SOURCE_MAP_RECORDS_BUILD_INFO]`', () => {
    const r = record()
    const res = collectUiSourceMapRecordsFromModule({
      buildInfo: { [UI_SOURCE_MAP_RECORDS_BUILD_INFO]: [r] },
    })
    expect(res).toEqual([r])
  })

  test('returns an empty array when buildInfo is missing or the key is missing', () => {
    expect(collectUiSourceMapRecordsFromModule({})).toEqual([])
    expect(
      collectUiSourceMapRecordsFromModule({ buildInfo: {} }),
    ).toEqual([])
  })

  test('ignores non-array values at the build-info key', () => {
    expect(
      collectUiSourceMapRecordsFromModule({
        buildInfo: { [UI_SOURCE_MAP_RECORDS_BUILD_INFO]: 'not-an-array' },
      }),
    ).toEqual([])
  })

  test('recurses into a concatenated module\'s children', () => {
    const a = record({ filename: 'a.tsx' })
    const b = record({ filename: 'b.tsx' })
    const c = record({ filename: 'c.tsx' })
    const res = collectUiSourceMapRecordsFromModule({
      buildInfo: { [UI_SOURCE_MAP_RECORDS_BUILD_INFO]: [a] },
      modules: [
        {
          buildInfo: { [UI_SOURCE_MAP_RECORDS_BUILD_INFO]: [b] },
        },
        {
          buildInfo: { [UI_SOURCE_MAP_RECORDS_BUILD_INFO]: [c] },
        },
      ],
    })
    expect(res).toEqual([a, b, c])
  })
})

describe('compareUiSourceMapRecord', () => {
  test('sorts by filename primarily', () => {
    expect(
      compareUiSourceMapRecord(
        record({ filename: 'a' }),
        record({ filename: 'b' }),
      ),
    ).toBeLessThan(0)
  })

  test('falls through to line / column / uiSourceMap', () => {
    const base = record({ filename: 'same' })
    expect(compareUiSourceMapRecord(base, { ...base, lineNumber: 2 }))
      .toBeLessThan(0)
    expect(
      compareUiSourceMapRecord(
        { ...base, lineNumber: 1 },
        { ...base, lineNumber: 1, columnNumber: 5 },
      ),
    ).toBeLessThan(0)
    expect(
      compareUiSourceMapRecord(
        { ...base, uiSourceMap: 1 },
        { ...base, uiSourceMap: 2 },
      ),
    ).toBeLessThan(0)
  })
})

describe('createUiSourceMap', () => {
  test('packs records into the compact v1 shape, deduplicating `sources`', () => {
    const records = [
      record({
        filename: 'a.tsx',
        lineNumber: 1,
        columnNumber: 0,
        uiSourceMap: 10,
      }),
      record({
        filename: 'b.tsx',
        lineNumber: 2,
        columnNumber: 3,
        uiSourceMap: 20,
      }),
      record({
        filename: 'a.tsx',
        lineNumber: 4,
        columnNumber: 5,
        uiSourceMap: 30,
      }),
    ]
    expect(createUiSourceMap(records, '/repo')).toEqual({
      version: 1,
      sources: ['a.tsx', 'b.tsx'],
      mappings: [
        [0, 1, 0],
        [1, 2, 3],
        [0, 4, 5],
      ],
      uiMaps: [10, 20, 30],
    })
  })

  test('drops records without a filename', () => {
    expect(
      createUiSourceMap([
        record({ filename: '' }),
        record({ filename: 'kept.tsx' }),
      ], '/repo'),
    ).toEqual({
      version: 1,
      sources: ['kept.tsx'],
      mappings: [[0, 1, 0]],
      uiMaps: [0],
    })
  })

  test('empty input yields an empty payload', () => {
    expect(createUiSourceMap([], '/repo')).toEqual({
      version: 1,
      sources: [],
      mappings: [],
      uiMaps: [],
    })
  })
})

describe('createUiSourceMap -> remapUiTree', () => {
  // A CI build checks the repository out under a machine-specific prefix, so
  // the loader hands the UI source map paths like
  // `<rootDir>/apps/app/src/components/Badge/index.tsx`. A consumer can only
  // reach the authored file if what it reads back is relative to the repo.
  const rootDir = '/opt/build/src/git.example.com/acme/storefront'
  const remoteUrl = 'https://git.example.com/acme/storefront'

  const records: UiSourceMapRecord[] = [
    {
      uiSourceMap: 101,
      filename: `${rootDir}/apps/app/src/common/themes.tsx`,
      lineNumber: 635,
      columnNumber: 11,
    },
    {
      uiSourceMap: 202,
      filename: `${rootDir}/apps/app/src/components/Badge/index.tsx`,
      lineNumber: 21,
      columnNumber: 7,
    },
  ]

  test('a node resolves to a repo-relative source, not a build path', async () => {
    const uiSourceMap = createUiSourceMap(records, rootDir)
    expect(uiSourceMap.sources).toEqual([
      'apps/app/src/common/themes.tsx',
      'apps/app/src/components/Badge/index.tsx',
    ])

    const remapped = await remapUiTree(
      {
        nodeIndex: 101,
        debugMetadataUrl: 'https://example.test/debug-metadata.json',
        children: [
          {
            nodeIndex: 202,
            debugMetadataUrl: 'https://example.test/debug-metadata.json',
          },
        ],
      },
      () =>
        Promise.resolve({
          artifacts: [],
          uiSourceMap,
          buildInfo: { git: { remoteUrl } },
        } as unknown as DebugMetadataAsset),
    )

    expect(remapped).toMatchObject({
      repo: 'acme/storefront',
      source: 'apps/app/src/common/themes.tsx',
      line: 635,
      column: 11,
      children: [
        {
          repo: 'acme/storefront',
          source: 'apps/app/src/components/Badge/index.tsx',
          line: 21,
          column: 7,
        },
      ],
    })
  })

  test('a path outside the repository root keeps its distance from it', () => {
    expect(
      createUiSourceMap(
        [{
          uiSourceMap: 1,
          filename: '/opt/build/src/git.example.com/acme/shared/ui.tsx',
          lineNumber: 1,
          columnNumber: 0,
        }],
        rootDir,
      ).sources,
    ).toEqual(['../shared/ui.tsx'])
  })
})
