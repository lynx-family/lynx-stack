// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test, vi } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal()
  const { readFileSync: originalReadFileSync } =
    original as typeof import('node:fs')
  return {
    ...original as object,
    readFileSync: vi.fn().mockImplementation((filePath: string) => {
      if (
        /[\\/](?:packages[\\/])?react[\\/]*package\.json$/.test(filePath)
      ) {
        return JSON.stringify({ version: '0.111.0' })
      } else {
        return originalReadFileSync(filePath)
      }
    }),
  }
})

describe('@lynx-js/react/compat - alias', () => {
  test('alias with @lynx-js/react < 0.112.0', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const { pluginReactAlias } = await import('../../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
        ],
      },
    })
    const [config] = await rsbuild.initConfigs()
    expect(config?.resolve?.alias ?? {}).not.toHaveProperty(
      '@lynx-js/react/compat$',
    )
  })
})
