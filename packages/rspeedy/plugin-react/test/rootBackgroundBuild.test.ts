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

import type { PluginReactLynxOptions } from '../src/pluginReactLynx.js'
import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

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

describe('root <Background> detection (enableMTSRendering: "auto")', () => {
  test('a root <Background> entry assembles the main-thread bundle by default', async () => {
    const assets = await buildFixture({ main: 'index.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toBeTypeOf('string')

    // Assembled, with the fallback snapshot named for the pre-hydration frame.
    expect(mainThread).toContain('__initMTSDefines')
    expect(mainThread).toMatch(/__setRootMTSFallback\("__snapshot_[^"]+"\)/)

    // Business logic stays off the main thread; the background keeps it.
    expect(mainThread).not.toContain('root-background-business-marker')
    const background = Object.entries(assets).find(([name]) =>
      /^\.rspeedy\/main\/background[^/]*\.js$/.test(name)
    )?.[1]
    expect(background).toContain('root-background-business-marker')
  })

  test('a nested <Background> does not turn the mode on', async () => {
    const assets = await buildFixture({ main: 'nested.tsx' }, undefined)

    const mainThread = assets['.rspeedy/main/main-thread.js']!
    expect(mainThread).toBeTypeOf('string')

    // The classic dual-thread build: business code is compiled for the main
    // thread, and no assembled-defines runtime exists.
    expect(mainThread).not.toContain('__initMTSDefines')
    expect(mainThread).toContain('header-on-the-first-screen')
  })

  test('`enableMTSRendering: true` is the escape hatch back to the classic build', async () => {
    const assets = await buildFixture(
      { main: 'index.tsx' },
      { enableMTSRendering: true },
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

  test('warns when the root fallback contains a user component', async () => {
    const warnings = collectWarnings()

    const assets = await buildFixture(
      { main: 'user-component-fallback.tsx' },
      undefined,
    )

    // The mode still turns on — the warning explains the empty fallback.
    expect(assets['.rspeedy/main/main-thread.js']).toContain(
      '__initMTSDefines',
    )
    expect(warnings().join('\n')).toMatch(
      /fallback[\s\S]*user component/,
    )
  })

  test('warns on an entry left without a root <Background> in a multi-entry build', async () => {
    const warnings = collectWarnings()

    const assets = await buildFixture(
      { first: 'index.tsx', second: 'nested.tsx' },
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
      /"second"[\s\S]*no root-level <Background>/,
    )
  })
})
