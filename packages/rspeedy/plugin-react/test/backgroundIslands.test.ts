// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * `experimental_backgroundIslands`: the same `<Background>` fold as
 * `enableMTSRendering: false`, but with the main thread still compiling and
 * rendering everything around the boundaries.
 *
 * The two are told apart by what happens *outside* a boundary: under
 * `enableMTSRendering: false` the main thread compiles only the entry and its
 * fallbacks, so an entry that defers nothing has an empty first frame. Under
 * this option it compiles the app as usual and each boundary is a hole in it.
 */
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import type { PluginReactLynxOptions } from '../src/pluginReactLynx.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

const ignoreCSSLoaderWorkaround = {
  name: 'ignore-css-loader-workaround',
  pre: ['lynx:react'],
  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID }) => {
      const rule = chain.module
        .rules.get('css:react:main-thread')
        .uses.get(CHAIN_ID.USE.IGNORE_CSS)
      rule.loader(rule.get('loader') as string + '.ts')
    })
  },
} as RsbuildPlugin

function collectAssets(assets: Record<string, string>) {
  return {
    name: 'collect-assets',
    apply(compiler: Rspack.Compiler) {
      compiler.hooks.compilation.tap('collect-assets', (compilation) => {
        compilation.hooks.processAssets.tap('collect-assets', (files) => {
          for (const name in files) {
            assets[name] = files[name]!.source().toString()
          }
        })
      })
    },
  } as Rspack.RspackPluginInstance
}

async function buildFixture(
  entries: Record<string, string>,
  options: PluginReactLynxOptions,
): Promise<Record<string, string>> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  const assets: Record<string, string> = {}
  const tmp = await fs.mkdtemp(
    path.join(tmpdir(), 'rspeedy-react-test-background-islands-'),
  )

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode: 'production',
      source: {
        entry: Object.fromEntries(
          Object.entries(entries).map(([name, fixture]) => [
            name,
            fileURLToPath(
              new URL(`./fixtures/root-background/${fixture}`, import.meta.url),
            ),
          ]),
        ),
      },
      output: { distPath: { root: tmp } },
      plugins: [pluginReactLynx(options), ignoreCSSLoaderWorkaround],
      tools: { rspack: { plugins: [collectAssets(assets)] } },
    },
  })

  try {
    await rsbuild.build()
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }

  return assets
}

function backgroundOf(
  assets: Record<string, string>,
  entry: string,
): string {
  const found = Object.entries(assets).find(([name]) =>
    new RegExp(`^\\.rspeedy/${entry}/background[^/]*\\.js$`).test(name)
  )?.[1]
  expect(found).toBeTypeOf('string')
  return found!
}

const ASSEMBLY_OPEN = 'var __initMTSDefines = function ('

/**
 * The assembled section and everything else in the chunk.
 *
 * The section is a runtime module, so it is emitted near the top of the
 * chunk with the app code after it — slicing at its opening alone would put
 * the whole bundle on the "assembled" side and make any comparison vacuous.
 */
function splitAssembledSection(
  mainThread: string,
): { owned: string, assembled: string } {
  const start = mainThread.indexOf(ASSEMBLY_OPEN)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = mainThread.indexOf('\n};', start)
  expect(end).toBeGreaterThan(start)
  return {
    assembled: mainThread.slice(start, end),
    owned: mainThread.slice(0, start) + mainThread.slice(end),
  }
}

function definitionIds(source: string): Set<string> {
  return new Set(source.match(/__snapshot_[0-9a-z]+_[0-9a-z]+_\d+/g) ?? [])
}

const ISLANDS: PluginReactLynxOptions = {
  enableMTSRendering: true,
  experimental_backgroundIslands: true,
}

describe('experimental_backgroundIslands', () => {
  test('cuts the deferred subtrees while the rest keeps rendering', async () => {
    const assets = await buildFixture({ main: 'multi-island.tsx' }, ISLANDS)
    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toBeTypeOf('string')

    // Not deferred: still compiled for and rendered by the main thread. Under
    // `enableMTSRendering: false` this only survives because it sits in the
    // entry's own closure; here it is ordinary main-thread business code.
    expect(mainThread).toContain('middle-not-deferred-logic')

    // Every fallback is compiled for the main thread, including the one
    // nested inside a component that is itself first-screen content.
    expect(mainThread).toContain('skeleton-A-logic')
    expect(mainThread).toContain('skeleton-B-logic')
    expect(mainThread).toContain('skeleton-C-logic')

    // The deferred subtrees' logic is gone from the main thread…
    expect(mainThread).not.toContain('feed-A-deferred-logic')
    expect(mainThread).not.toContain('feed-B-deferred-logic')
    expect(mainThread).not.toContain('feed-C-deferred-logic')

    // …and complete on the background.
    const background = backgroundOf(assets, 'main')
    expect(background).toContain('feed-A-deferred-logic')
    expect(background).toContain('feed-B-deferred-logic')
    expect(background).toContain('feed-C-deferred-logic')
    expect(background).toContain('middle-not-deferred-logic')
  })

  test('assembles the deferred subtrees\' definitions for hydration', async () => {
    const assets = await buildFixture({ main: 'multi-island.tsx' }, ISLANDS)
    const mainThread = assets['.rspeedy/main/main-thread.js']!

    // The section exists, the runtime registers it from inside itself, and
    // it carries real element-building code for the deferred subtrees.
    const { assembled } = splitAssembledSection(mainThread)
    expect(mainThread).toContain('__initMTSDefines({')
    expect(assembled).toContain('__CreateView')
    expect(definitionIds(assembled).size).toBeGreaterThan(0)
  })

  test('an entry that defers nothing is untouched', async () => {
    // The reason this option exists next to `enableMTSRendering: false`: that
    // mode applies to the whole build, so a second entry without a boundary
    // renders an empty first frame. Here it compiles and renders normally.
    const assets = await buildFixture(
      { deferring: 'multi-island.tsx', plain: 'no-background.tsx' },
      ISLANDS,
    )

    const plain = assets['.rspeedy/plain/main-thread.js']!
    expect(plain).toBeTypeOf('string')
    expect(plain).toContain('no-background-entry')

    // …while the deferring entry still gets its holes.
    const deferring = assets['.rspeedy/deferring/main-thread.js']!
    expect(deferring).toContain('skeleton-A-logic')
    expect(deferring).not.toContain('feed-A-deferred-logic')
  })

  test('describes every definition exactly once', async () => {
    // The property the subtraction exists for, checked against the build that
    // owns every definition outright: the classic main-thread bundle. Islands
    // must partition that same id set between what it still compiles and what
    // it assembles — nothing missing (hydration would build an incomplete
    // tree) and nothing in both (a definition registered twice).
    const islands = await buildFixture({ main: 'multi-island.tsx' }, ISLANDS)
    const classic = await buildFixture({ main: 'multi-island.tsx' }, {
      enableMTSRendering: true,
    })

    const mainThread = islands['.rspeedy/main/main-thread.js']!
    const { owned, assembled } = splitAssembledSection(mainThread)

    const ownedIds = definitionIds(owned)
    const assembledIds = definitionIds(assembled)
    const classicIds = definitionIds(classic['.rspeedy/main/main-thread.js']!)

    expect(classicIds.size).toBeGreaterThan(0)
    // Both halves carry their share — otherwise this would pass by doing
    // nothing at all.
    expect(ownedIds.size).toBeGreaterThan(0)
    expect(assembledIds.size).toBeGreaterThan(0)

    expect([...ownedIds].filter(id => assembledIds.has(id))).toEqual([])
    expect(
      [...classicIds].filter(id => !ownedIds.has(id) && !assembledIds.has(id)),
    ).toEqual([])
    expect(ownedIds.size + assembledIds.size).toBe(classicIds.size)
  })

  test('keeps the main-thread bundle concatenated', async () => {
    // The assembled definitions are registered from inside the runtime rather
    // than by a second entry module for this reason: two entry roots disable
    // module concatenation for the whole chunk, which costs far more than the
    // fold removes.
    const assets = await buildFixture({ main: 'multi-island.tsx' }, ISLANDS)
    const mainThread = assets['.rspeedy/main/main-thread.js']!

    // A concatenated bundle has no per-module wrapper functions.
    expect(mainThread.match(/\n\d+:? ?\(/g) ?? []).toEqual([])
  })

  test('stays off in development, where the runtime component renders the fallback', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const assets: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-background-islands-dev-'),
    )
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        mode: 'development',
        source: {
          entry: {
            main: fileURLToPath(
              new URL(
                './fixtures/root-background/multi-island.tsx',
                import.meta.url,
              ),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [pluginReactLynx(ISLANDS), ignoreCSSLoaderWorkaround],
        tools: { rspack: { plugins: [collectAssets(assets)] } },
      },
    })
    try {
      await rsbuild.build()
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    // Not folded: the deferred subtree is compiled for the main thread and
    // the `<Background>` component skips it at runtime instead.
    expect(mainThread).toContain('feed-A-deferred-logic')
    expect(mainThread).not.toContain('var __initMTSDefines = function (')
  })

  test('rejects the combinations it cannot serve', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    expect(() =>
      pluginReactLynx({
        experimental_backgroundIslands: true,
        experimental_useElementTemplate: true,
      })
    ).toThrowError(/experimental_useElementTemplate/)

    expect(() =>
      pluginReactLynx({
        experimental_backgroundIslands: true,
        enableMTSRendering: false,
      })
    ).toThrowError(/enableMTSRendering/)
  })
})
