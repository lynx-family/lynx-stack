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

// A production build: HMR compiles the background with a MIXED target, so
// the background-only assembly intentionally stays off under `dev`.
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

describe('experimental_backgroundOnlyAssembly', () => {
  test('assembles the background-only definitions into a rendering main thread', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const assets: Record<string, string> = {}
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-background-only-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL(
                './fixtures/background-only-assembly/index.tsx',
                import.meta.url,
              ),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [
          pluginReactLynx({ experimental_backgroundOnlyAssembly: true }),
          ignoreCSSLoaderWorkaround,
        ],
        tools: { rspack: { plugins: [collectAssets(assets)] } },
      },
    })

    try {
      await rsbuild.build()

      const mainThread = assets['.rspeedy/main/main-thread.js']!
      expect(mainThread).toBeTypeOf('string')

      // The main thread keeps rendering business code…
      expect(mainThread).toContain('app-renders-on-the-main-thread')

      // …while the background-only module compiles as a stub shell: its body
      // logic and top-level side effects are gone…
      expect(mainThread).not.toContain('feed-body-logic-marker')
      expect(mainThread).not.toContain('feed-top-level-side-effect-marker')

      // …and its snapshot definition arrives through assembly — inside the
      // `__initMTSDefines` runtime section the prepended init module calls
      // before the first-screen render — surviving production minification
      // because that call keeps it alive.
      expect(mainThread).toContain('feed-snapshot-static-marker')

      // The background bundle stays complete (hashed filename in production).
      const backgroundName = Object.keys(assets).find(name =>
        /\.rspeedy\/main\/background(?:\.[^./]+)?\.js$/.test(name)
      )
      expect(backgroundName).toBeTypeOf('string')
      const background = assets[backgroundName!]!
      expect(background).toContain('feed-body-logic-marker')
      expect(background).toContain('feed-top-level-side-effect-marker')
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test('rejects Element Template, which it does not support yet', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    expect(() =>
      pluginReactLynx({
        experimental_backgroundOnlyAssembly: true,
        experimental_useElementTemplate: true,
      })
    ).toThrowError(/experimental_useElementTemplate/)
  })

  test('rejects enableMTSRendering: false, which already assembles everything', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    expect(() =>
      pluginReactLynx({
        experimental_backgroundOnlyAssembly: true,
        enableMTSRendering: false,
      })
    ).toThrowError(/enableMTSRendering/)
  })
})
