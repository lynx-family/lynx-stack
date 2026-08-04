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
import type { SerializedInstance } from './createMainThreadEnv.js'
import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

async function buildFixture(entry: string, tmp: string) {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  let mainThread = ''

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode: 'production',
      source: {
        entry: {
          main: fileURLToPath(
            new URL(`./fixtures/root-background/${entry}`, import.meta.url),
          ),
        },
      },
      output: { distPath: { root: tmp } },
      plugins: [
        // The declarative trigger: no `experimental_enableMTSRendering` option at all.
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

describe('root <Background fallback> with a user component', () => {
  test('the first frame renders the fallback component, and hydration replaces it', async () => {
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-root-background-runtime-'),
    )

    try {
      const mainThread = await buildFixture('component-fallback.tsx', tmp)

      // The fallback is real main-thread code: the *logic* of `Skeleton`'s
      // body — a helper it calls, not an element definition — was compiled
      // into this bundle.
      expect(mainThread).toContain('-from-fallback-logic')
      // The deferred app's logic was not: only its element definitions travel
      // here, through the assembly channel, for hydration to build from.
      expect(mainThread).not.toContain('root-background-business-marker')
      expect(mainThread).toContain('__initMTSDefines')

      const { env, getPage, lifecycleEvents } = createMainThreadEnv()
      vm.createContext(env)
      vm.runInContext(mainThread, env, { filename: 'main-thread.js' })

      const renderPage = env['renderPage'] as (data: unknown) => void
      expect(renderPage).toBeTypeOf('function')

      renderPage({})

      // The pre-hydration first frame is what the component rendered: all
      // three rows, each label computed by its body at runtime — not a static
      // blob, and not an empty page.
      const firstFrame = JSON.stringify(getPage())
      for (const row of [0, 1, 2]) {
        expect(firstFrame).toContain(`skeleton-row-${row}-from-fallback-logic`)
      }

      // The first-screen sync hands that tree to the background, whose
      // ordinary hydration diff replaces it with the real content.
      const firstScreen = lifecycleEvents.find((event) =>
        Array.isArray(event) && event[0] === 'rLynxFirstScreen'
      ) as [string, { root: string }] | undefined
      expect(firstScreen).toBeDefined()

      const serializedRoot = JSON.parse(
        firstScreen![1].root,
      ) as SerializedInstance
      expect(serializedRoot.children?.length).toBeGreaterThan(0)

      const definitions = [
        ...new Set(mainThread.match(/__snapshot_[0-9a-f]+_[0-9a-f]+_\d+/g)),
      ]
      const contentId = definitions.at(-1)!
      const fallbackRoot = serializedRoot.children![0]!

      const rLynxChange = env['rLynxChange'] as (args: {
        data: string
        patchOptions: { reloadVersion: number }
      }) => void
      rLynxChange({
        data: JSON.stringify({
          patchList: [{
            id: 1,
            snapshotPatch: [
              /* CreateElement(type, id) */ 0,
              contentId,
              100,
              /* InsertBefore(parent, child, before, slotIndex) */ 1,
              fallbackRoot.id,
              100,
              undefined,
              0,
              /* RemoveChild(parent, child) */ 2,
              fallbackRoot.id,
              fallbackRoot.children![0]!.id,
            ],
          }],
        }),
        patchOptions: { reloadVersion: 0 },
      })

      expect(JSON.stringify(getPage())).not.toContain(
        'skeleton-row-0-from-fallback-logic',
      )
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })
})
