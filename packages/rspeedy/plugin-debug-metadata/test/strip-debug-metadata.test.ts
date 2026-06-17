// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core'

import { stripDebugMetadataFromOutput } from '../src/pluginLynxDebugMetadata.js'

/**
 * A fake bundler compiler that records which assets `stripDebugMetadataFromOutput`
 * deletes. `trigger()` fires the registered `thisCompilation` →
 * `processAssets` hooks in order, mimicking a build pass.
 */
function fakeChild(opts: { mode?: string, assets: string[] }) {
  const deleted: string[] = []
  let processAssetsCb: (() => void) | undefined
  const compilation = {
    hooks: {
      processAssets: {
        tap(_options: unknown, cb: () => void) {
          processAssetsCb = cb
        },
      },
    },
    getAssets() {
      return opts.assets.map((name) => ({ name }))
    },
    deleteAsset(name: string) {
      deleted.push(name)
    },
  }

  let thisCompilationCb: ((c: typeof compilation) => void) | undefined
  const compiler = {
    options: { mode: opts.mode ?? 'production' },
    webpack: { Compilation: { PROCESS_ASSETS_STAGE_REPORT: 5000 } },
    hooks: {
      thisCompilation: {
        tap(_name: string, cb: (c: typeof compilation) => void) {
          thisCompilationCb = cb
        },
      },
    },
  }

  return {
    compiler: compiler as unknown as Rspack.Compiler,
    deleted,
    trigger() {
      thisCompilationCb?.(compilation)
      processAssetsCb?.()
    },
  }
}

describe('stripDebugMetadataFromOutput', () => {
  beforeEach(() => {
    // Neutral baseline: not a debug build, not dev.
    rstest.stubEnv('DEBUG', '')
    rstest.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    rstest.unstubAllEnvs()
  })

  test('deletes debug-metadata.json from a production build, keeps other assets', () => {
    const child = fakeChild({
      assets: [
        '.rspeedy/main/debug-metadata.json',
        '.rspeedy/main/main-thread.js',
        'main/template.js',
      ],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual(['.rspeedy/main/debug-metadata.json'])
  })

  test('still deletes under RSDOCTOR=true (the build is production)', () => {
    rstest.stubEnv('RSDOCTOR', 'true')
    const child = fakeChild({
      assets: ['.rspeedy/main/debug-metadata.json'],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual(['.rspeedy/main/debug-metadata.json'])
  })

  test('deletes every debug-metadata.json (e.g. main + lazy bundles)', () => {
    const child = fakeChild({
      assets: [
        '.rspeedy/main/debug-metadata.json',
        '.rspeedy/async/lazy-comp.jsx/debug-metadata.json',
        '.rspeedy/main/main-thread.js',
      ],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual([
      '.rspeedy/main/debug-metadata.json',
      '.rspeedy/async/lazy-comp.jsx/debug-metadata.json',
    ])
  })

  test('only matches the exact basename, not a similarly-named asset', () => {
    const child = fakeChild({
      assets: [
        '.rspeedy/main/my-debug-metadata.json',
        '.rspeedy/main/debug-metadata.json.map',
      ],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual([])
  })

  test('keeps the asset when DEBUG=rspeedy', () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    const child = fakeChild({
      assets: ['.rspeedy/main/debug-metadata.json'],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual([])
  })

  test('keeps the asset for a development-mode build (middleware serves it)', () => {
    const child = fakeChild({
      mode: 'development',
      assets: ['.rspeedy/main/debug-metadata.json'],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual([])
  })

  test('keeps the asset when NODE_ENV=development', () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const child = fakeChild({
      assets: ['.rspeedy/main/debug-metadata.json'],
    })
    stripDebugMetadataFromOutput(child.compiler)
    child.trigger()
    expect(child.deleted).toEqual([])
  })

  test('walks every child of a MultiCompiler', () => {
    const a = fakeChild({ assets: ['.rspeedy/main/debug-metadata.json'] })
    const b = fakeChild({ assets: ['.rspeedy/home/debug-metadata.json'] })
    const multi = {
      compilers: [a.compiler, b.compiler],
    } as unknown as Rspack.MultiCompiler
    stripDebugMetadataFromOutput(multi)
    a.trigger()
    b.trigger()
    expect(a.deleted).toEqual(['.rspeedy/main/debug-metadata.json'])
    expect(b.deleted).toEqual(['.rspeedy/home/debug-metadata.json'])
  })
})
