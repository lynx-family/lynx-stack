// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, rstest, test } from '@rstest/core'

// Use the built entry so the plugin's loaders resolve to compiled `.js`
// files. A CSS-importing fixture in dev mode exercises the CSS HMR path,
// which cannot resolve the `.ts` loaders when running from source.
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

describe('lazy bundle entry chunk', () => {
  // Regression test for #4044: merging a shared module into the entry chunk
  // (`splitChunks.name: 'main'`) must not make each lazy bundle template emit
  // the entry chunk's `main.css.hot-update.json`, which conflicts with the
  // entry template's own hot-update file.
  test('does not conflict on the entry css hot-update', async () => {
    rstest.stubEnv('NODE_ENV', 'development')

    try {
      const tmp = await fs.mkdtemp(
        path.join(tmpdir(), 'rspeedy-react-test-lazy-shared-entry-'),
      )

      const rspeedy = await createRspeedy({
        rspeedyConfig: {
          mode: 'development',
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/lazy-shared-entry/index.tsx',
                  import.meta.url,
                ),
              ),
            },
          },
          output: { distPath: { root: tmp } },
          tools: { rspack: { optimization: { chunkIds: 'named' } } },
          splitChunks: {
            name: 'main',
            chunks: 'all',
            minSize: 0,
          } as never,
          plugins: [pluginReactLynx()],
        },
      })

      const result = await rspeedy.build()
      await result.close()

      const files = await fs.readdir(tmp, { recursive: true })
      const entryHotUpdates = files
        .map(file => String(file).replaceAll('\\', '/'))
        .filter(file => file.endsWith('main.css.hot-update.json'))

      // The entry chunk hot-update is emitted exactly once, by the entry
      // template — not once per lazy bundle.
      expect(entryHotUpdates).toStrictEqual([
        '.lynx/main/main.css.hot-update.json',
      ])
    } finally {
      rstest.unstubAllEnvs()
    }
  })
})
