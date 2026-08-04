// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createMainThreadEnv } from './createMainThreadEnv.js'
import type { SerializedInstance, StubElement } from './createMainThreadEnv.js'
import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

async function buildIslandFixture(entry: string, tmp: string): Promise<string> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  let mainThread = ''

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
              name: 'collect-main-thread',
              apply(compiler) {
                compiler.hooks.compilation.tap(
                  'collect-main-thread',
                  (compilation) => {
                    compilation.hooks.processAssets.tap(
                      'collect-main-thread',
                      (assets) => {
                        for (const name in assets) {
                          if (name.endsWith('main-thread.js')) {
                            mainThread = assets[name]!.source().toString()
                          }
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

  return mainThread
}

function flatten(element: StubElement | undefined): StubElement[] {
  if (!element) {
    return []
  }
  return [element, ...element.children.flatMap((child) => flatten(child))]
}

function flattenInstances(
  instance: SerializedInstance,
): SerializedInstance[] {
  return [
    instance,
    ...(instance.children ?? []).flatMap((child) => flattenInstances(child)),
  ]
}

describe('root <MainThread> island runtime', () => {
  test('renders the island as the first frame and keeps its elements through hydration', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-main-thread-runtime-'),
    )

    try {
      const mainThread = await buildIslandFixture('index.tsx', tmp)

      const { env, getPage, lifecycleEvents } = createMainThreadEnv()
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const renderPage = env['renderPage'] as (data: unknown) => void
      expect(renderPage).toBeTypeOf('function')

      renderPage({})

      // The first frame is the island, not the static fallback: the main
      // thread ran `Shell`'s render body.
      const page = getPage()
      const painted = JSON.stringify(page)
      expect(painted).toContain('root-main-thread-island-marker')
      expect(painted).not.toContain('root-main-thread-fallback-marker')
      // …including what `<Background>` defers: its fallback, not `Feed`.
      expect(painted).toContain('feed-skeleton')
      expect(painted).not.toContain('root-main-thread-feed-marker')

      // The island's element identities, before the background exists.
      const before = flatten(page)
      const islandText = before.find((element) =>
        element.attributes['text'] === 'root-main-thread-island-marker'
      )
      expect(islandText).toBeDefined()

      // The first-screen sync carries the island's instance tree over, which
      // is what the background's hydrate diffs against.
      const firstScreen = lifecycleEvents.find((event) =>
        Array.isArray(event) && event[0] === 'rLynxFirstScreen'
      ) as [string, { root: string }] | undefined
      expect(firstScreen).toBeDefined()

      const serializedRoot = JSON.parse(
        firstScreen![1].root,
      ) as SerializedInstance
      const instances = flattenInstances(serializedRoot)
      // Not the "empty root" of the plain assembled bundle: the island's
      // whole subtree is there for the diff to match against.
      expect(instances.length).toBeGreaterThan(2)

      // What the background's hydrate produces for an island it adopts: the
      // matched instances keep their ids, and only the `<Background>`
      // boundary — whose fallback the main thread rendered instead of
      // `Feed` — is removed and replaced.
      const islandRoot = serializedRoot.children![0]!
      const skeleton = flattenInstances(islandRoot).find((instance) =>
        instance !== islandRoot && (instance.children ?? []).length === 0
      )!
      const rLynxChange = env['rLynxChange'] as (args: {
        data: string
        patchOptions: { reloadVersion: number }
      }) => void
      rLynxChange({
        data: JSON.stringify({
          patchList: [{
            id: 1,
            snapshotPatch: [
              /* RemoveChild(parent, child) */ 2,
              islandRoot.id,
              skeleton.id,
            ],
          }],
        }),
        patchOptions: { reloadVersion: 0 },
      })

      // Adoption, not replacement: the island's elements are the same objects
      // after the handover — nothing was torn down and rebuilt.
      const after = flatten(getPage())
      expect(after).toContain(islandText)
      expect(JSON.stringify(getPage())).toContain(
        'root-main-thread-island-marker',
      )
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
