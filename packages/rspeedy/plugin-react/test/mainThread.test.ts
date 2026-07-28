// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'development')

// The main-thread CSS loader is resolved as a `.js` file, which this package's
// tests cannot load; the same workaround as in `lazy.test.ts`.
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

describe('enableMTSRendering: false', () => {
  test('assembles the main-thread bundle from the collected definitions', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const assets: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL('./fixtures/main-thread-disabled.tsx', import.meta.url),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [
          pluginReactLynx({ enableMTSRendering: false }),
          ignoreCSSLoaderWorkaround,
        ],
        tools: { rspack: { plugins: [collectAssets(assets)] } },
      },
    })

    try {
      await rsbuild.build()

      const mainThread = assets['.rspeedy/main/main-thread.js']!
      expect(mainThread).toBeTypeOf('string')

      // The definitions the background collected, with the element creation the
      // main thread needs to apply patches.
      expect(mainThread).toContain('snapshotCreatorMap')
      expect(mainThread).toContain('__CreateView')
      expect(mainThread).toContain('__CreateText')

      // ... and none of the business code that produced them.
      expect(mainThread).not.toContain('business-only-marker')
      expect(assets['.rspeedy/main/background.js'])
        .toContain('business-only-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('registers components the main thread would not have compiled', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const assets: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-dropped-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL(
                './fixtures/main-thread-disabled/index.tsx',
                import.meta.url,
              ),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [
          pluginReactLynx({ enableMTSRendering: false }),
          ignoreCSSLoaderWorkaround,
        ],
        tools: { rspack: { plugins: [collectAssets(assets)] } },
      },
    })

    try {
      await rsbuild.build()

      // `__MAIN_THREAD__ ? null : <Counter />` drops the component from a
      // main-thread compilation, which is what leaves the main thread without a
      // definition for a snapshot the background can still create. Collecting
      // from the background is what keeps it registered.
      expect(assets['.rspeedy/main/main-thread.js'])
        .toContain('counter-only-on-the-background')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('assembles a main-thread section for each lazy bundle', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const assets: Record<string, string> = {}
    const lepusRoots: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-lazy-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL('./fixtures/lazy-bundle/index.tsx', import.meta.url),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [
          pluginReactLynx({ enableMTSRendering: false }),
          ignoreCSSLoaderWorkaround,
        ],
        tools: {
          rspack: {
            plugins: [
              collectAssets(assets),
              {
                name: 'collect-lepus-roots',
                apply(compiler) {
                  compiler.hooks.compilation.tap(
                    'collect-lepus-roots',
                    (compilation) => {
                      LynxTemplatePlugin
                        .getLynxTemplatePluginHooks(
                          compilation as unknown as Parameters<
                            typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                          >[0],
                        )
                        .beforeEncode.tap('collect-lepus-roots', (args) => {
                          const { root } = args.encodeData.lepusCode
                          if (root) {
                            lepusRoots[args.intermediate] = root.source
                              .source()
                              .toString()
                          }
                          return args
                        })
                    },
                  )
                },
              } as Rspack.RspackPluginInstance,
            ],
          },
        },
      },
    })

    try {
      await rsbuild.build()

      const lazyIntermediate = Object.keys(lepusRoots).find(name =>
        name.includes('LazyComponent')
      )
      expect(lazyIntermediate).toBeTypeOf('string')

      // The lazy bundle gets its own section: it registers with the lazy
      // bundle's own entry name (its CSS scope), and reuses the host's runtime
      // instead of bundling a second copy.
      const lazySection = lepusRoots[lazyIntermediate!]!
      expect(lazySection).toContain('function (globDynamicComponentEntry)')
      expect(lazySection).toContain('__webpack_require__.mtDefinesRuntime')
      expect(lazySection).toContain('"LazyComponent"')

      // The lazy bundle's definitions stay out of the card, which would
      // otherwise register them under the card's entry name.
      expect(assets['.rspeedy/main/main-thread.js'])
        .not.toContain('"LazyComponent"')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('rejects Element Template, which it does not support yet', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    expect(() =>
      pluginReactLynx({
        enableMTSRendering: false,
        experimental_useElementTemplate: true,
      })
    ).toThrowError(/experimental_useElementTemplate/)
  })
})
