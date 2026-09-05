// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core'

import type { LepusNGDebugInfoBody } from '@lynx-js/debug-metadata'

import {
  parseDebugInfoUnits,
  takeDebugInfoUnit,
} from '../src/collectors/bytecode-debug-info.js'

const body = (functionName: string): LepusNGDebugInfoBody => ({
  function_source: 'function foo(){}',
  function_number: 1,
  end_line_num: 1,
  function_info: [
    {
      function_id: 0,
      function_name: functionName,
      file_name: 'main-thread.js',
      line_number: 1,
      column_number: 0,
      pc2line_len: 0,
      pc2line_buf: [],
      line_col: [],
      pc2caller_info: {},
    },
  ],
})

const artifact = (filename: string, root = false) => ({
  filename,
  path: `.lynx/main/${filename}`,
  tasmSection: root ? ['lepusCode', 'root'] : undefined,
})

describe('parseDebugInfoUnits', () => {
  test('returns undefined for empty string', () => {
    expect(parseDebugInfoUnits('')).toBeUndefined()
  })

  test('returns undefined for invalid JSON', () => {
    expect(parseDebugInfoUnits('{ not json')).toBeUndefined()
  })

  test('returns undefined for a payload that holds no unit', () => {
    expect(parseDebugInfoUnits(JSON.stringify({}))).toBeUndefined()
    expect(parseDebugInfoUnits(JSON.stringify({ other: 1 }))).toBeUndefined()
    expect(parseDebugInfoUnits(JSON.stringify([body('foo')]))).toBeUndefined()
  })

  test('collects every unit the encoder filed', () => {
    const units = parseDebugInfoUnits(JSON.stringify({
      lepusNG_debug_info: body('root'),
      'Card__main-thread': body('section'),
    }))

    expect([...units!.keys()]).toEqual([
      'lepusNG_debug_info',
      'Card__main-thread',
    ])
  })
})

describe('takeDebugInfoUnit', () => {
  test('takes the root unit for a card main thread chunk', () => {
    const units = new Map([['lepusNG_debug_info', body('root')]])

    expect(takeDebugInfoUnit(artifact('main-thread.js', true), units))
      .toEqual(body('root'))
    expect(units.size).toBe(0)
  })

  test('prefers the unit named after the asset over the root unit', () => {
    const units = new Map([
      ['lepusNG_debug_info', body('root')],
      ['Card__main-thread', body('section')],
    ])

    expect(takeDebugInfoUnit(artifact('Card__main-thread.js', true), units))
      .toEqual(body('section'))
    expect([...units.keys()]).toEqual(['lepusNG_debug_info'])
  })

  test('gives every main thread entry its own unit', () => {
    const units = new Map([
      ['First__main-thread', body('first')],
      ['Second__main-thread', body('second')],
    ])

    expect(takeDebugInfoUnit(artifact('First__main-thread.js', true), units))
      .toEqual(body('first'))
    expect(takeDebugInfoUnit(artifact('Second__main-thread.js'), units))
      .toEqual(body('second'))
    expect(units.size).toBe(0)
  })

  test('takes nothing when no unit was compiled from the asset', () => {
    const units = new Map([['Other__main-thread', body('other')]])

    expect(takeDebugInfoUnit(artifact('Card__main-thread.js'), units))
      .toBeUndefined()
    expect(units.size).toBe(1)
  })
})
