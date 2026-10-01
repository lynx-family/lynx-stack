// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'development')

const RELOADER_KEY = '__LYNX_MAIN_THREAD_ENTRY_RELOADER__'
// The production build normalises quotes, so match on the symbol key only.
const ASSIGNS = new RegExp(
  `globalThis\\[Symbol\\.for\\(.${RELOADER_KEY}.\\)\\]\\s*=\\s*\\(\\)\\s*=>`,
)
const INVOKES = new RegExp(
  `\\}[\\s;]*globalThis\\[Symbol\\.for\\(.${RELOADER_KEY}.\\)\\]\\(\\)`,
)

async function buildMainThread(
  reloadEntryReeval: boolean,
): Promise<string> {
  const { pluginReactLynx } = await import('../src/index.js')

  const tmp = await mkdtemp(
    path.join(tmpdir(), 'rspeedy-react-test-reload-entry-'),
  )

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      source: {
        entry: {
          main: fileURLToPath(new URL('./fixtures/basic.tsx', import.meta.url)),
        },
      },
      output: {
        distPath: { root: tmp },
      },
      tools: {
        rspack: {
          context: dirname(fileURLToPath(import.meta.url)),
          resolve: {
            extensionAlias: {
              '.js': ['.ts', '.js'],
              '.jsx': ['.tsx', '.jsx'],
            },
          },
        },
      },
      plugins: [
        pluginReactLynx({
          experimental_reloadEntryReeval: reloadEntryReeval,
        }),
        pluginStubRspeedyAPI(),
      ],
    },
  })

  await rsbuild.build()

  return readFile(join(tmp, '.lynx/main/main-thread.js'), 'utf8')
}

describe('pluginReactLynx: experimental_reloadEntryReeval', () => {
  test('leaves the main thread entry unwrapped by default', async () => {
    const mainThread = await buildMainThread(false)

    expect(ASSIGNS.test(mainThread)).toBe(false)
  })

  test('wraps the main thread entry when enabled', async () => {
    const mainThread = await buildMainThread(true)

    expect(ASSIGNS.test(mainThread)).toBe(true)
    expect(INVOKES.test(mainThread)).toBe(true)
  })
})
