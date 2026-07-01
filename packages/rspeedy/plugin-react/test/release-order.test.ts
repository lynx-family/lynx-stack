// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { glob, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin } from '@rsbuild/core'
import { afterAll, beforeAll, describe, expect, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

const tempDirs: string[] = []
afterAll(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

// A stand-in for the (out-of-tree) legacy source-map release plugin: a raw
// banner at BannerPlugin's default stage (ADDITIONS) that calls
// `_SetSourceMapRelease`, like the real one.
const legacyReleaseStub: RsbuildPlugin = {
  name: 'legacy-release-stub',
  setup(api) {
    api.modifyBundlerChain((chain, { rspack }) => {
      chain.plugin('legacy-release-stub').use(rspack.BannerPlugin, [{
        test: /\.js$/,
        raw: true,
        banner:
          'var __LEGACY_RELEASE__="legacy";try{throw Error(__LEGACY_RELEASE__)}catch(e){if(typeof _SetSourceMapRelease==="function")_SetSourceMapRelease(e)}\n',
      }])
    })
  },
}

async function build(): Promise<string> {
  const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-release-order'))
  tempDirs.push(tmp)

  const { pluginReactLynx } = await import('../src/index.js')

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      source: {
        entry: {
          main: fileURLToPath(
            new URL('./fixtures/release-order/index.tsx', import.meta.url),
          ),
        },
      },
      output: {
        distPath: { root: tmp },
        filenameHash: false,
        minify: false,
      },
      plugins: [pluginReactLynx(), legacyReleaseStub],
    },
  })
  const result = await rsbuild.build()
  await result.close()

  return tmp
}

async function readBundle(tmp: string, name: string): Promise<string> {
  for await (const file of glob(path.join(tmp, '.rspeedy', '**', name))) {
    return await readFile(file, 'utf8')
  }
  throw new Error(`${name} not found`)
}

/**
 * Both threads inject `_SetSourceMapRelease` and the engine keeps the last one.
 * debug-metadata is prepended in front of the legacy release, so the legacy
 * `_SetSourceMapRelease` runs last and wins. `insideWrapper` additionally checks
 * the release sits inside the background bundle wrapper (the background thread
 * has no global `_SetSourceMapRelease`, so it must register from within).
 */
async function expectLegacyWins(
  tmp: string,
  bundleName: string,
  insideWrapper = false,
) {
  const bundle = await readBundle(tmp, bundleName)
  const debugMetadata = bundle.indexOf('__DEBUG_METADATA_RELEASE__')
  const legacy = bundle.indexOf('__LEGACY_RELEASE__')

  expect(debugMetadata).toBeGreaterThan(-1)
  expect(legacy).toBeGreaterThan(debugMetadata) // legacy runs last -> wins

  if (insideWrapper) {
    const wrapperOpen = bundle.indexOf('.define(')
    expect(wrapperOpen).toBeGreaterThan(-1)
    expect(debugMetadata).toBeGreaterThan(wrapperOpen)
  }
}

describe('source-map release ordering', () => {
  let tmp: string
  beforeAll(async () => {
    tmp = await build()
  }, 60_000)

  test('background: legacy release wins, inside the wrapper', async () => {
    await expectLegacyWins(tmp, 'background*.js', true)
  })

  test('main-thread: legacy release wins', async () => {
    await expectLegacyWins(tmp, 'main-thread*.js')
  })
})
