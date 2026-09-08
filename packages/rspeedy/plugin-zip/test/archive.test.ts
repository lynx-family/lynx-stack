// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomBytes } from 'node:crypto'

import { unzipSync } from 'fflate'
import { expect, test } from 'vitest'

import { createArchive, validatePath } from '../src/archive.js'

test('stores highly compressible files to respect the 100:1 extraction limit', () => {
  const contents = new Uint8Array(1024 * 1024)
  const archive = createArchive(new Map([['main.lynx.bundle', contents]]))
  let compressedSize = 0
  const files = unzipSync(archive, {
    filter(file) {
      compressedSize = file.size
      expect(file.originalSize).toBeLessThanOrEqual(
        Math.max(file.size, 1) * 100,
      )
      return true
    },
  })
  expect(compressedSize).toBe(contents.length)
  expect(files['main.lynx.bundle']).toEqual(contents)
})

test('rejects archives exceeding the upload budget', () => {
  expect(() =>
    createArchive(new Map([['large.bin', randomBytes(10 * 1024 * 1024)]]))
  )
    .toThrow('10 MiB')
})

test.each([
  '../escape',
  '/absolute',
  'a\\b',
  'a//b',
  'a/./b',
  'C:/file',
  'a\0b',
])('rejects unsafe path %s', name => {
  expect(() => validatePath(name)).toThrow('Unsafe ZIP path')
})

test('counts UTF-8 bytes and enforces path depth', () => {
  expect(() => validatePath(`${'目录'.repeat(43)}/file`)).toThrow('limits')
  expect(() => validatePath(`${'a/'.repeat(20)}file`)).toThrow('limits')
})
