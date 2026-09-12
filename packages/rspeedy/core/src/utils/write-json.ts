// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const CHUNK_SIZE = 1 << 20

function* serialize(value: unknown, depth: number): Generator<string> {
  if (
    depth === 0 || value === null || typeof value !== 'object'
    || typeof (value as { toJSON?: unknown }).toJSON === 'function'
  ) {
    yield JSON.stringify(value) ?? 'null'
    return
  }

  if (Array.isArray(value)) {
    yield '['
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        yield ','
      }
      yield* serialize(value[i], depth - 1)
    }
    yield ']'
    return
  }

  yield '{'
  let first = true
  for (const [key, item] of Object.entries(value)) {
    if (
      item === undefined || typeof item === 'function'
      || typeof item === 'symbol'
    ) {
      continue
    }
    yield `${first ? '' : ','}${JSON.stringify(key)}:`
    first = false
    yield* serialize(item, depth - 1)
  }
  yield '}'
}

function* buffered(chunks: Iterable<string>): Generator<string> {
  let buffer = ''
  for (const chunk of chunks) {
    buffer += chunk
    if (buffer.length >= CHUNK_SIZE) {
      yield buffer
      buffer = ''
    }
  }
  if (buffer) {
    yield buffer
  }
}

/**
 * Write `value` as minified JSON, the same text `JSON.stringify` returns,
 * without ever holding all of it in one string: V8 caps a string at about
 * 512 MiB, which the stats of a large project exceed.
 */
export async function writeJson(
  filePath: string,
  value: unknown,
  depth = 4,
): Promise<void> {
  await pipeline(
    Readable.from(buffered(serialize(value, depth))),
    createWriteStream(filePath),
  )
}
