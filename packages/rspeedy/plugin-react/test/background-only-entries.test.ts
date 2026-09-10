// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

async function entryNamesOf(
  experimental_backgroundOnlyEntries: string[] | undefined,
) {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      plugins: [
        pluginReactLynx(
          experimental_backgroundOnlyEntries
            ? { experimental_backgroundOnlyEntries }
            : {},
        ),
      ],
      source: {
        entry: {
          app: './src/app.ts',
          page: './src/page.tsx',
        },
      },
    },
  })

  const [config] = await rsbuild.initConfigs()
  return Object.keys(config?.entry ?? {})
}

describe('experimental_backgroundOnlyEntries', () => {
  test('every entry gets a main-thread entry by default', async () => {
    const names = await entryNamesOf(undefined)

    expect(names).toContain('app__main-thread')
    expect(names).toContain('page__main-thread')
  })

  test('a listed entry drops its main-thread entry', async () => {
    const names = await entryNamesOf(['app'])

    expect(names).not.toContain('app__main-thread')
    expect(names).toContain('app')
  })

  test('an entry that is not listed keeps its main-thread entry', async () => {
    const names = await entryNamesOf(['app'])

    expect(names).toContain('page__main-thread')
  })

  test('an unknown entry name changes nothing', async () => {
    const names = await entryNamesOf(['nope'])

    expect(names).toContain('app__main-thread')
    expect(names).toContain('page__main-thread')
  })
})
