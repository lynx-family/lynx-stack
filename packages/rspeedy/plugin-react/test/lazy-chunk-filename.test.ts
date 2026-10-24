// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildConfig } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

async function buildLazyBundle(
  rspeedyConfig: Omit<RsbuildConfig, 'source' | 'plugins'>,
  fixture = './fixtures/lazy-chunk-filename/index.tsx',
  filePattern = /(?:background|main-thread)[^/]*\.js$/,
): Promise<{ files: string[], root: string }> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  const tmp = await fs.mkdtemp(
    path.join(tmpdir(), 'rspeedy-react-test-lazy-chunk-filename-'),
  )

  const rspeedy = await createRspeedy({
    rspeedyConfig: {
      ...rspeedyConfig,
      source: {
        entry: {
          main: fileURLToPath(
            new URL(
              fixture,
              import.meta.url,
            ),
          ),
        },
      },
      output: {
        ...rspeedyConfig.output,
        distPath: {
          root: tmp,
        },
      },
      plugins: [pluginReactLynx()],
    },
  })

  const result = await rspeedy.build()
  await result.close()

  const files = await fs.readdir(tmp, { recursive: true })
  return {
    files: files
      .map(file => file.replaceAll('\\', '/'))
      .filter(file => filePattern.test(file))
      .map(file => file.replace(/\.[0-9a-f]{8}\.js$/, '.[hash].js'))
      .map(file =>
        file.replace(
          /^static\/js\/vendors-_react_background_node_modules_pnpm_lynx-js_internal-preact_.+\.js$/,
          'static/js/vendors-_react_background_node_modules_pnpm_lynx-js_internal-preact_[version].js',
        )
      )
      .sort(),
    root: tmp,
  }
}

function buildLazySharedSplit(name?: string): Promise<
  { files: string[], root: string }
> {
  return buildLazyBundle(
    {
      tools: {
        rspack: {
          optimization: {
            chunkIds: 'named',
          },
        },
      },
      splitChunks: {
        preset: 'none',
        cacheGroups: {
          shared: {
            test: /[\\/]shared\.ts$/,
            ...(name ? { name } : {}),
            minChunks: 2,
            minSize: 0,
            priority: 10,
          },
        },
      },
    },
    './fixtures/lazy-shared-split/index.tsx',
    /.*\.js$/,
  )
}

describe('lazy bundle chunk filename', () => {
  test('keeps shared async chunks on the default async path', async () => {
    const { files, root } = await buildLazySharedSplit()

    expect(files).toMatchInlineSnapshot(`
      [
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageA.tsx/background.js",
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageA.tsx/main-thread.js",
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageA.tsx/worklet-runtime.js",
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageB.tsx/background.js",
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageB.tsx/main-thread.js",
        ".lynx/lazy-bundle/fixtures_lazy-shared-split_PageB.tsx/worklet-runtime.js",
        ".lynx/main/background.js",
        ".lynx/main/main-thread.js",
        "static/js/async/shared-_react_background_fixtures_lazy-shared-split_shared_ts.js",
        "static/js/vendors-_react_background_node_modules_pnpm_lynx-js_internal-preact_[version].js",
      ]
    `)

    const pageABundle = await fs.readFile(
      path.join(
        root,
        '.lynx/lazy-bundle/fixtures_lazy-shared-split_PageA.tsx/background.js',
      ),
      'utf-8',
    )
    expect(pageABundle).not.toContain('PageB')

    const mainBundle = await fs.readFile(
      path.join(root, '.lynx/main/background.js'),
      'utf-8',
    )
    const lazyChunkIds =
      (/__webpack_require__\.lynx_aci = \{([^}]*)\}/.exec(mainBundle))?.[1]
    expect(lazyChunkIds).toBeDefined()
    expect(lazyChunkIds).not.toMatch(/"shared[^"]*":/)
  })

  test('does not route a named shared chunk to a lazy bundle', async () => {
    const { files, root } = await buildLazySharedSplit('shared')

    expect(files).toContain('static/js/async/shared.js')

    const mainBundle = await fs.readFile(
      path.join(root, '.lynx/main/background.js'),
      'utf-8',
    )
    const lazyChunkIds =
      (/__webpack_require__\.lynx_aci = \{([^}]*)\}/.exec(mainBundle))?.[1]
    expect(lazyChunkIds).toBeDefined()
    expect(lazyChunkIds).not.toMatch(/"shared":/)
  })

  test('follows the entry filename hash in production', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    try {
      const { files } = await buildLazyBundle({})

      expect(files).toMatchInlineSnapshot(`
        [
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/background.[hash].js",
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/main-thread.js",
          ".lynx/main/background.[hash].js",
          ".lynx/main/main-thread.js",
        ]
      `)
    } finally {
      rstest.unstubAllEnvs()
    }
  })

  test('has no hash with output.filenameHash: false', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    try {
      const { files } = await buildLazyBundle({
        output: { filenameHash: false },
      })

      expect(files).toMatchInlineSnapshot(`
        [
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/background.js",
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/main-thread.js",
          ".lynx/main/background.js",
          ".lynx/main/main-thread.js",
        ]
      `)
    } finally {
      rstest.unstubAllEnvs()
    }
  })

  test('stays in the output root of its environment', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    try {
      const { files } = await buildLazyBundle({
        environments: { lynx: {}, web: {} },
      })

      expect(files).toMatchInlineSnapshot(`
        [
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/background.[hash].js",
          ".lynx/lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/main-thread.js",
          ".lynx/main/background.[hash].js",
          ".lynx/main/main-thread.js",
          "lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/background.[hash].js",
          "lazy-bundle/fixtures_lazy-chunk-filename_LazyComponent.tsx/main-thread.js",
          "main/background.[hash].js",
          "main/main-thread.js",
        ]
      `)
    } finally {
      rstest.unstubAllEnvs()
    }
  })
})
