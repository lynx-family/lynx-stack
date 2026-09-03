// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core'

import { UI_SOURCE_MAP_RECORDS_BUILD_INFO } from '@lynx-js/debug-metadata'
import type { UiSourceMapRecord } from '@lynx-js/debug-metadata'

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
    expect(createUiSourceMap(records)).toEqual({
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
      ]),
    ).toEqual({
      version: 1,
      sources: ['kept.tsx'],
      mappings: [[0, 1, 0]],
      uiMaps: [0],
    })
  })

  test('empty input yields an empty payload', () => {
    expect(createUiSourceMap([])).toEqual({
      version: 1,
      sources: [],
      mappings: [],
      uiMaps: [],
    })
  })
})
