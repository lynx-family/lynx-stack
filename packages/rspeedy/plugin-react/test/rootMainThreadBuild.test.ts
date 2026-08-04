// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

async function buildIslandFixture(
  entry: string,
  tmp: string,
): Promise<{ mainThread: string, background: string, warnings: string[] }> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  let mainThread = ''
  let background = ''
  const warnings: string[] = []

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode: 'production',
      source: {
        entry: {
          main: fileURLToPath(
            new URL(`./fixtures/root-main-thread/${entry}`, import.meta.url),
          ),
        },
      },
      output: { distPath: { root: tmp } },
      plugins: [
        // The declarative trigger: no `enableMTSRendering` option at all.
        pluginReactLynx(),
        {
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
        } as RsbuildPlugin,
      ],
      tools: {
        rspack: {
          plugins: [
            {
              name: 'collect-assets',
              apply(compiler) {
                compiler.hooks.compilation.tap(
                  'collect-assets',
                  (compilation) => {
                    compilation.hooks.processAssets.tap(
                      'collect-assets',
                      (assets) => {
                        for (const name in assets) {
                          if (name.endsWith('main-thread.js')) {
                            mainThread = assets[name]!.source().toString()
                          } else if (name.endsWith('.js')) {
                            background += assets[name]!.source().toString()
                          }
                        }
                        for (const warning of compilation.warnings) {
                          warnings.push(warning.message)
                        }
                      },
                    )
                  },
                )
              },
            } as Rspack.RspackPluginInstance,
          ],
        },
      },
    },
  })

  await rsbuild.build()

  return { mainThread, background, warnings }
}

describe('root <MainThread> island build', () => {
  test('compiles the island into the main thread and nothing else', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-main-thread-'),
    )

    try {
      const { mainThread, background, warnings } = await buildIslandFixture(
        'index.tsx',
        tmp,
      )

      expect(warnings).toEqual([])

      // The mode is on: the bundle is assembled from the definitions the
      // background compilation collected.
      expect(mainThread).toContain('__initMTSDefines')

      // The island's render *body* is on the main thread — not just its
      // markup, which a snapshot definition would have carried anyway.
      expect(mainThread).toContain('root-main-thread-body-marker')
      expect(mainThread).toContain('root-main-thread-island-marker')
      // …and so is its worklet.
      expect(mainThread).toContain('root-main-thread-worklet-marker')
      // …registered as the first frame through the island entry.
      expect(mainThread).toContain('__REACT_LYNX_MTS_ROOT_ISLAND__')

      // The deferred subtree is not. `Feed` is `'background only'`, so only
      // its element definition survives into the main-thread layer — the
      // hydration needs that to build the real content — while the code its
      // body pulled in is gone.
      expect(mainThread).toContain('root-main-thread-feed-marker')
      expect(mainThread).not.toContain('root-main-thread-heavy-marker')
      expect(background).toContain('root-main-thread-heavy-marker')

      // Every snapshot definition is registered exactly once: the island's
      // module registers its own, so the assembly must leave it out.
      const islandSnapshot = /__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/.exec(
        mainThread.slice(mainThread.indexOf('root-main-thread-island-marker')),
      )
      expect(islandSnapshot).not.toBeNull()
      for (
        const id of new Set(
          mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g) ?? [],
        )
      ) {
        const registrations = mainThread.split(
          `snapshotCreatorMap[${JSON.stringify(id)}]=`,
        ).length - 1
        expect(
          registrations,
          `${id} should be registered at most once`,
        ).toBeLessThanOrEqual(1)
      }
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('says so when the root boundary wraps an unmarked component', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-main-thread-unmarked-'),
    )

    try {
      const { mainThread, warnings } = await buildIslandFixture(
        'unmarked.tsx',
        tmp,
      )

      expect(warnings.join('\n')).toContain(`'main thread component'`)
      expect(warnings.join('\n')).toContain('<Plain>')

      // The component's render body stays off the main thread — only its
      // snapshot definition travels, as for any other module…
      expect(mainThread).not.toContain('root-main-thread-unmarked-body-marker')
      expect(mainThread).toContain('root-main-thread-unmarked-marker')
      // …so the boundary's static fallback paints instead, through the same
      // channel a root `<Background fallback>` uses.
      expect(mainThread).toContain('__setRootMTSFallback')
      expect(mainThread).toContain('root-main-thread-fallback-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
