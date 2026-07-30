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

    try {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-disabled.tsx',
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

      await rsbuild.build()

      const mainThread = assets['.rspeedy/main/main-thread.js']!
      expect(mainThread).toBeTypeOf('string')

      expect(mainThread).toContain('snapshotCreatorMap')
      expect(mainThread).toContain('__CreateView')
      expect(mainThread).toContain('__CreateText')

      expect(mainThread).not.toContain('business-only-marker')
      expect(assets['.rspeedy/main/background.js'])
        .toContain('business-only-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('keeps each entry to its own definitions and shares the common ones', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const assets: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-main-thread-multi-'),
    )

    try {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              first: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-multi/first.tsx',
                  import.meta.url,
                ),
              ),
              second: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-multi/second.tsx',
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

      await rsbuild.build()

      const first = assets['.rspeedy/first/main-thread.js']!
      const second = assets['.rspeedy/second/main-thread.js']!

      expect(first).toContain('first-entry-only')
      expect(first).not.toContain('second-entry-only')
      expect(second).toContain('second-entry-only')
      expect(second).not.toContain('first-entry-only')

      expect(first).toContain('shared-across-entries')
      expect(second).toContain('shared-across-entries')
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

    try {
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/mts-rendering-disabled/index.tsx',
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

      await rsbuild.build()

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

    try {
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

      await rsbuild.build()

      const lazyIntermediate = Object.keys(lepusRoots).find(name =>
        name.includes('LazyComponent')
      )
      expect(lazyIntermediate).toBeTypeOf('string')

      const lazySection = lepusRoots[lazyIntermediate!]!
      expect(lazySection).toContain('function (globDynamicComponentEntry)')
      expect(lazySection).toContain(
        '__REACT_LYNX_MTS_DEFINES_RUNTIME__',
      )
      expect(lazySection).toContain('"LazyComponent"')

      expect(assets['.rspeedy/main/main-thread.js'])
        .not.toContain('"LazyComponent"')

      expect(assets['.rspeedy/main/main-thread.js'])
        .toContain('globalThis.processEvalResultByHost')
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
