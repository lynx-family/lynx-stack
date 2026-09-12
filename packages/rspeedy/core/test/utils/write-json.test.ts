// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from '@rstest/core'

import { writeJson } from '../../src/utils/write-json.js'

describe('writeJson', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'rspeedy-write-json-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function write(value: unknown, depth?: number): Promise<string> {
    const file = path.join(dir, 'stats.json')
    await writeJson(file, value, depth)
    return readFile(file, 'utf-8')
  }

  test('writes the same text as JSON.stringify', async () => {
    const value = {
      version: '1.0.0',
      count: 0,
      flag: false,
      nothing: null,
      dropped: undefined,
      method() {
        return 1
      },
      when: new Date(0),
      children: [
        {
          name: 'lynx',
          modules: [
            { id: 1, name: './a.js', nested: { deep: [1, [2, [3]]] } },
            { id: 2, name: 'ünicode "quoted"\n ', skipped: undefined },
          ],
          empty: [],
          emptyObject: {},
        },
      ],
      sparse: [undefined, () => 1, 'x'],
    }

    for (const depth of [0, 1, 2, 4, 8]) {
      expect(await write(value, depth)).toBe(JSON.stringify(value))
    }
  })

  test('writes a value larger than one chunk', async () => {
    const value = {
      children: [{
        modules: Array.from({ length: 50_000 }, (_, id) => ({
          id,
          name: `./src/module-${id}.js`,
          size: id,
        })),
      }],
    }

    expect(await write(value)).toBe(JSON.stringify(value))
  })
})
