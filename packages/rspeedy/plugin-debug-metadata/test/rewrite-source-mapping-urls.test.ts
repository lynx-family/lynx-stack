// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { rewriteSourceMappingURLs } from '../src/index.js'

class FakeSource {
  constructor(private readonly value: string) {}

  source(): string {
    return this.value
  }
}

function createCompilation(
  initialAssets: Array<
    { name: string, source: string, info: Record<string, unknown> }
  >,
): {
  compilation: Rspack.Compilation
  readAsset: (name: string) => string | undefined
} {
  const assets = new Map(
    initialAssets.map(asset => [
      asset.name,
      {
        name: asset.name,
        source: new FakeSource(asset.source),
        info: asset.info,
      },
    ]),
  )
  const compilation = {
    compiler: {
      webpack: {
        sources: { RawSource: FakeSource },
      },
    },
    getAssets() {
      return [...assets.values()]
    },
    getAsset(name: string) {
      return assets.get(name)
    },
    updateAsset(
      name: string,
      source: FakeSource,
      info: Record<string, unknown>,
    ) {
      assets.set(name, { name, source, info })
    },
  } as unknown as Rspack.Compilation

  return {
    compilation,
    readAsset: name => assets.get(name)?.source.source(),
  }
}

describe('rewriteSourceMappingURLs', () => {
  test('synchronizes rewritten custom-section assets back to encodeData', () => {
    const before = 'console.log(42)\n//# sourceMappingURL=widget-alpha.js.map'
    const { compilation, readAsset } = createCompilation([{
      name: 'widget-alpha.js',
      source: before,
      info: {
        'lynx:tasm-section': ['customSections', 'widget-alpha'],
      },
    }])
    const args = {
      encodeData: {
        compilerOptions: {},
        lepusCode: { root: undefined, chunks: [] },
        manifest: {},
        css: { chunks: [] },
        customSections: {
          'widget-alpha': {
            content: before,
            encoding: 'JsBytecode',
          },
        },
        sourceContent: {
          config: {
            debugMetadataUrl:
              'http://localhost:3000/.rspeedy/debug-metadata.json',
          },
        },
      },
    } as unknown as Parameters<typeof rewriteSourceMappingURLs>[1]

    rewriteSourceMappingURLs(compilation, args)

    const expected =
      'http://localhost:3000/.rspeedy/debug-metadata.json?field=source-map&path=widget-alpha.js.map'
    expect(readAsset('widget-alpha.js')).toContain(expected)
    expect(args.encodeData.customSections['widget-alpha']?.content).toContain(
      expected,
    )
  })
})
