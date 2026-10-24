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
): Promise<string[]> {
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
              './fixtures/lazy-chunk-filename/index.tsx',
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
  return files
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => /(?:background|main-thread)[^/]*\.js$/.test(file))
    .map(file => file.replace(/\.[0-9a-f]{8}\.js$/, '.[hash].js'))
    .sort()
}

describe('lazy bundle chunk filename', () => {
  test('follows the entry filename hash in production', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    try {
      await expect(buildLazyBundle({})).resolves.toMatchInlineSnapshot(`
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
      await expect(buildLazyBundle({ output: { filenameHash: false } }))
        .resolves.toMatchInlineSnapshot(`
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
      await expect(buildLazyBundle({ environments: { lynx: {}, web: {} } }))
        .resolves.toMatchInlineSnapshot(`
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
