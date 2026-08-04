// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { logger } from '@rsbuild/core'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { afterEach, describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import type { PluginReactLynxOptions } from '../src/pluginReactLynx.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

afterEach(() => {
  rstest.restoreAllMocks()
})

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

// `applyEntry` warns through `api.logger ?? console` — capture both.
function collectWarnings(): () => string[] {
  const messages: string[] = []
  const record = (...args: unknown[]) => void messages.push(args.join(' '))
  rstest.spyOn(logger, 'warn').mockImplementation(record)
  rstest.spyOn(console, 'warn').mockImplementation(record)
  return () => messages
}

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
  options: PluginReactLynxOptions | undefined,
  mode: 'production' | 'development' = 'production',
) {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  const assets: Record<string, string> = {}
  const tmp = await fs.mkdtemp(
    path.join(tmpdir(), 'rspeedy-react-test-root-background-'),
  )

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode,
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
      plugins: [
        options === undefined ? pluginReactLynx() : pluginReactLynx(options),
        ignoreCSSLoaderWorkaround,
      ],
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

describe('root <Background> detection (experimental_enableMTSRendering: "auto")', () => {
  test('a root <Background> entry assembles the main-thread bundle by default', async () => {
    const assets = await buildFixture({ main: 'index.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toBeTypeOf('string')

    // Assembled from the background-collected definitions.
    expect(mainThread).toContain('__initMTSDefines')

    // The static fallback still renders, through the entry's own main-thread
    // compilation rather than a metadata channel.
    expect(mainThread).toContain('root-background-skeleton-marker')

    // The deferred app's logic stays off the main thread; the background
    // keeps it. Only its element definitions travel here, for hydration.
    expect(mainThread).not.toContain('root-background-business-marker')
    const background = Object.entries(assets).find(([name]) =>
      /^\.rspeedy\/main\/background[^/]*\.js$/.test(name)
    )?.[1]
    expect(background).toContain('root-background-business-marker')
  })

  test('the entry module itself still runs on the main thread', async () => {
    // `root.render` has to run there for the fallback to exist at all, so an
    // entry's top-level code is executed on both threads — the fold only
    // drops the *deferred subtree's* closure.
    const assets = await buildFixture({ main: 'index.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toContain('root.render')
    expect(mainThread).not.toContain('HeavyApp')
  })

  test('a nested <Background> turns the mode on and defers only its own subtree', async () => {
    const assets = await buildFixture({ main: 'nested.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toBeTypeOf('string')

    // Position does not change the mechanism — the boundary is folded where
    // it sits, so the mode is on...
    expect(mainThread).toContain('__initMTSDefines')
    // ...the surrounding first-screen content is compiled for the main
    // thread, as is the boundary's fallback...
    expect(mainThread).toContain('header-on-the-first-screen')
    expect(mainThread).toContain('feed-skeleton')
    // ...and only the deferred subtree's logic is gone (its element
    // definitions still travel here for hydration).
    expect(mainThread).not.toContain('feed-C-deferred-logic')
  })

  test('an app that defers nothing keeps the classic build', async () => {
    const assets = await buildFixture({ main: 'no-background.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).not.toContain('__initMTSDefines')
    expect(mainThread).toContain('no-background-entry')
  })

  test('`experimental_enableMTSRendering: true` is the escape hatch back to the classic build', async () => {
    const assets = await buildFixture(
      { main: 'index.tsx' },
      { experimental_enableMTSRendering: true },
    )

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).not.toContain('__initMTSDefines')
    expect(mainThread).toContain('root-background-business-marker')
  })

  test('development builds keep the classic path (the component renders the fallback)', async () => {
    const assets = await buildFixture(
      { main: 'index.tsx' },
      undefined,
      'development',
    )

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).not.toContain('__initMTSDefines')
    expect(mainThread).toContain('root-background-business-marker')
  })

  test('compiles a user component in the root fallback for the main thread', async () => {
    const warnings = collectWarnings()

    const assets = await buildFixture(
      { main: 'user-component-fallback.tsx' },
      undefined,
    )

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toContain('__initMTSDefines')
    // The fallback component's body is real main-thread code now, so nothing
    // about it is worth warning over.
    expect(mainThread).toContain('spinner-from-fallback-logic')
    expect(warnings().join('\n')).not.toMatch(/user component/)
  })

  test('folds every boundary where it stands, however many there are', async () => {
    const assets = await buildFixture({ main: 'multi-island.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!

    // Three boundaries with no tree relationship between them: two siblings
    // under the page and one inside a component that is itself first-screen
    // content. Every fallback is compiled for the main thread...
    for (const island of ['A', 'B', 'C']) {
      expect(mainThread).toContain(`skeleton-${island}-logic`)
    }
    // ...the component that positions the third one comes along, because it
    // is not deferred and has to render...
    expect(mainThread).toContain('middle-not-deferred-logic')
    // ...and each deferred subtree's logic is gone.
    for (const feed of ['A', 'B', 'C']) {
      expect(mainThread).not.toContain(`feed-${feed}-deferred-logic`)
    }
  })

  test('a boundary reachable only through an import still turns the mode on', async () => {
    // The entry has no `<Background>` of its own — detection follows its
    // relative imports to the one inside `Middle`.
    const assets = await buildFixture({ main: 'middle-only.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toContain('__initMTSDefines')
    expect(mainThread).toContain('skeleton-C-logic')
    expect(mainThread).not.toContain('feed-C-deferred-logic')
  })

  test('does not describe a fallback the main-thread bundle already carries', async () => {
    const assets = await buildFixture({ main: 'multi-island.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    const start = mainThread.indexOf('__initMTSDefines')
    expect(start).toBeGreaterThan(-1)

    // Walk to the end of the assembled-definitions function.
    let depth = 0
    let end = -1
    for (let i = mainThread.indexOf('{', start); i < mainThread.length; i++) {
      const ch = mainThread[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const assembled = mainThread.slice(start, end + 1)
    const rest = mainThread.slice(0, start) + mainThread.slice(end + 1)

    const ids = [
      ...new Set(mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g) ?? []),
    ]
    expect(ids.length).toBeGreaterThan(0)

    // Every definition is described once: either the main thread compiles it
    // (an island) or the assembly carries it (a deferred subtree).
    const both = ids.filter((id) => assembled.includes(id) && rest.includes(id))
    expect(both).toEqual([])
    expect(ids.some((id) => assembled.includes(id))).toBe(true)
    expect(ids.some((id) => rest.includes(id))).toBe(true)
  })

  test('does not cost the main thread its scope hoisting', async () => {
    // The assembled bundle enters through the definitions runtime *and* the
    // app's entry. Listing those as two entry imports is the obvious
    // spelling, and it makes every module they share — the whole main-thread
    // runtime — reachable from two concatenation roots, so it is emitted
    // module by module instead of hoisted. The result was a main-thread
    // chunk ~40 KB *larger* than the classic build it is supposed to shrink.
    const [assembled, classic] = await Promise.all([
      buildFixture({ main: 'index.tsx' }, undefined),
      buildFixture({ main: 'index.tsx' }, {
        experimental_enableMTSRendering: true,
      }),
    ])

    const mainThread = assembled['.rspeedy/main/main-thread.js']!
    expect(mainThread).toContain('__initMTSDefines')

    // The fixture app is small, so what is left is the mode's fixed cost:
    // the definitions runtime and the assembled block. A regression here is
    // not subtle — losing concatenation costs an order of magnitude more.
    const overhead = mainThread.length
      - classic['.rspeedy/main/main-thread.js']!.length
    expect(overhead).toBeLessThan(20_000)
  })

  test('warns on an entry left without a root <Background> in a multi-entry build', async () => {
    const warnings = collectWarnings()

    const assets = await buildFixture(
      { first: 'index.tsx', second: 'no-background.tsx' },
      undefined,
    )

    // The mode is build-wide: both entries get the assembled bundle.
    expect(assets['.rspeedy/first/main-thread.js']).toContain(
      '__initMTSDefines',
    )
    expect(assets['.rspeedy/second/main-thread.js']).toContain(
      '__initMTSDefines',
    )
    expect(warnings().join('\n')).toMatch(
      /"second"[\s\S]*defers nothing with a <Background>/,
    )
  })
})
