// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

// `pluginReactAlias` reads `@lynx-js/react/package.json` with `fs`.
rstest.mock('node:fs', () => {
  const original = rstest.requireActual<typeof import('node:fs')>('node:fs')
  const readFileSync = ((file: unknown, ...rest: unknown[]) => {
    if (
      typeof file === 'string'
      && /[\\/](?:packages[\\/])?react[\\/]*package\.json$/.test(file)
    ) {
      return JSON.stringify({ version: '0.112.0' })
    }
    return (original.readFileSync as (...args: unknown[]) => unknown)(
      file,
      ...rest,
    )
  }) as typeof original.readFileSync
  return { ...original, readFileSync, default: { ...original, readFileSync } }
})

describe('@lynx-js/react/compat - alias', () => {
  test('alias with @lynx-js/react >= 0.112.0', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    const { pluginReactAlias } = await import('../../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
        ],
      },
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })
    const [config] = await rsbuild.initConfigs()
    expect(config?.resolve?.alias ?? {}).toHaveProperty(
      '@lynx-js/react/compat$',
    )
  })
})
