// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildConfig } from '@rsbuild/core'
import { describe, expect, onTestFinished, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

async function buildLazyBundle(
  rspeedyConfig: Omit<RsbuildConfig, 'source' | 'plugins'>,
): Promise<{ files: string[], root: string }> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  const tmp = await fs.mkdtemp(
    path.join(tmpdir(), 'rspeedy-react-test-lazy-chunk-filename-'),
  )
  onTestFinished(() => fs.rm(tmp, { recursive: true, force: true }))

  const rspeedy = await createRspeedy({
    rspeedyConfig: {
      ...rspeedyConfig,
      source: {
        entry: {
          main: fileURLToPath(
            new URL(
              './fixtures/lazy-shared-split/index.tsx',
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
    files: files.map(file => file.replaceAll('\\', '/')).sort(),
    root: tmp,
  }
}

describe('shared lazy bundle chunks', () => {
  test('keeps shared async JS outside both React lazy bundles', async () => {
    const { files, root } = await buildLazyBundle({
      splitChunks: {
        preset: 'none',
        cacheGroups: {
          shared: {
            test: /[\\/]shared\.ts$/,
            minChunks: 2,
            minSize: 0,
            priority: 10,
          },
        },
      },
      tools: {
        rspack: { optimization: { chunkIds: 'named' } },
      },
    })

    const sharedFiles = files.filter(file =>
      /^static\/js\/async\/shared.*\.js$/.test(file)
    )
    expect(sharedFiles).toHaveLength(1)
    const shared = await fs.readFile(path.join(root, sharedFiles[0]!), 'utf-8')
    expect(shared).toContain('SHARED_MODULE_BODY')
    for (const page of ['PageA', 'PageB']) {
      const directory =
        `.lynx/lazy-bundle/fixtures_lazy-shared-split_${page}.tsx`
      for (const thread of ['background', 'main-thread']) {
        expect(files).toContain(`${directory}/${thread}.js`)
      }
      const background = await fs.readFile(
        path.join(root, directory, 'background.js'),
        'utf-8',
      )
      expect(background).not.toContain('SHARED_MODULE_BODY')
      const mainThread = await fs.readFile(
        path.join(root, directory, 'main-thread.js'),
        'utf-8',
      )
      expect(mainThread).toContain('SHARED_MAIN_THREAD')
    }
    const main = await fs.readFile(
      path.join(root, '.lynx/main/background.js'),
      'utf-8',
    )
    const mapping = /__webpack_require__\.lynx_aci = (\{[^}]*\})/.exec(main)
    expect(mapping).not.toBeNull()
    expect(mapping![1]).not.toMatch(/"shared[^"]*":/)
    expect(mapping![1]).toContain('fixtures_lazy-shared-split_PageA.tsx')
    expect(mapping![1]).toContain('fixtures_lazy-shared-split_PageB.tsx')
  })
})
