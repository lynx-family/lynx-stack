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
        filePath.includes('packages/react')
        && filePath.endsWith('package.json')
      ) {
        return JSON.stringify({})
      } else {
        return originalReadFileSync(filePath)
      }
    }),
  }
})

describe('@lynx-js/react/compat - alias', () => {
  test('version field not found', async () => {
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

    try {
      await rsbuild.initConfigs()
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `[Error: version field not found in @lynx-js/react package]`,
      )
    }
  })
})
