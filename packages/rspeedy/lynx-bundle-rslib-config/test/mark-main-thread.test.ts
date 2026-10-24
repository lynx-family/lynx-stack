// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { MarkMainThreadWebpackPlugin } from '../src/webpack/MarkMainThreadWebpackPlugin.js'

const LAYER = 'react:main-thread'

interface Chunk {
  name: string
  files: string[]
  layers: string[]
}

function mark(chunks: Chunk[], entries: Record<string, string | undefined>) {
  const marked: string[] = []
  let processAssets: (() => void) | undefined
  const compilation = {
    entries: new Map(
      Object.entries(entries).map((
        [name, layer],
      ) => [name, { options: { layer } }]),
    ),
    entrypoints: new Map(
      Object.keys(entries).map(name => [name, {
        chunks: chunks.filter(chunk => chunk.name === name),
      }]),
    ),
    chunks,
    chunkGraph: {
      getChunkModulesIterable: (chunk: Chunk) =>
        chunk.layers.map(layer => ({ layer })),
    },
    getAsset: (file: string) =>
      file === 'missing.js' ? undefined : { source: {}, info: {} },
    updateAsset: (
      file: string,
      _source: unknown,
      info: Record<string, boolean>,
    ) => {
      if (info['lynx:main-thread']) {
        marked.push(file)
      }
    },
    hooks: {
      processAssets: {
        tap: (_options: unknown, callback: () => void) => {
          processAssets = callback
        },
      },
    },
  }
  const compiler = {
    webpack: { Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: -2000 } },
    hooks: {
      thisCompilation: {
        tap: (_name: string, callback: (compilation: unknown) => void) =>
          callback(compilation),
      },
    },
  }

  new MarkMainThreadWebpackPlugin({ layer: LAYER }).apply(compiler as never)
  processAssets?.()
  return marked
}

describe('MarkMainThreadWebpackPlugin', () => {
  test('marks the chunks of a main-thread entry and the chunks holding its modules', () => {
    expect(mark([
      { name: 'utils.m', files: ['utils.m.js', 'utils.m.css'], layers: [] },
      {
        name: 'shared',
        files: ['shared.js', 'missing.js'],
        layers: [LAYER, 'react:background'],
      },
      { name: 'utils', files: ['utils.js'], layers: ['react:background'] },
    ], {
      'utils.m': LAYER,
      utils: 'react:background',
    })).toStrictEqual(['utils.m.js', 'shared.js'])
  })
})
