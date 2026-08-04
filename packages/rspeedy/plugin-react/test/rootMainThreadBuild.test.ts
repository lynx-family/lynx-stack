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
  test('compiles the island for the main thread and nothing behind a <Background>', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-main-thread-'),
    )

    try {
      const { mainThread, background, warnings } = await buildIslandFixture(
        'index.tsx',
        tmp,
      )

      expect(warnings).toEqual([])

      // A root `<MainThread>` turns the mode on by itself, exactly as a root
      // `<Background>` does: the bundle is assembled from the definitions the
      // background compilation collected.
      expect(mainThread).toContain('__initMTSDefines')

      // The island's render *body* is on the main thread — not just its
      // markup, which a snapshot definition would have carried anyway…
      expect(mainThread).toContain('root-main-thread-body-marker')
      expect(mainThread).toContain('root-main-thread-island-marker')
      // …and so is its worklet.
      expect(mainThread).toContain('root-main-thread-worklet-marker')

      // What the island defers is not. The `<Background>` inside it folds to
      // its fallback on the main thread, so `Feed`'s body — and the code it
      // imported — never reaches this bundle. Its element definition still
      // travels, through the assembled definitions, because the hydration
      // needs it to build the real content.
      expect(mainThread).not.toContain('root-main-thread-feed-body-marker')
      expect(mainThread).not.toContain('root-main-thread-heavy-marker')
      expect(mainThread).toContain('root-main-thread-feed-marker')
      expect(background).toContain('root-main-thread-heavy-marker')

      // Every snapshot definition is registered exactly once: a module
      // compiled for the main thread registers its own, so the assembly must
      // leave it out.
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

  test(`'main thread component' reaches the main thread with nothing referencing it there`, async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-component-'),
    )

    try {
      const { mainThread } = await buildIslandFixture('index.tsx', tmp)

      // `Widget` sits inside `Feed`, behind the `<Background>` the main
      // thread folds away — nothing on the first-frame render path
      // references it. The marker is what puts its module in the bundle
      // anyway, so it is there to render whenever it is placed.
      expect(mainThread).toContain('root-main-thread-widget-body-marker')
      expect(mainThread).toContain('root-main-thread-widget-marker')
      // Its owner is still out, which is the point: the marker pulls in one
      // module, not the subtree it was reached through.
      expect(mainThread).not.toContain('root-main-thread-feed-body-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
