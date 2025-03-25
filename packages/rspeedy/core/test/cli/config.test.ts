// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { createRspeedy } from '../../src/create-rspeedy.js'

describe('rspeedy config test', () => {
  const fixturesRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )
  test('enable loadEnv by default', async () => {
    const root = join(fixturesRoot, 'project-with-env')
    const rsbuild = await createRspeedy({
      cwd: root,
    })
    const configs = await rsbuild.initConfigs()
    const maybeDefinePluginInstance = configs[0]?.plugins?.filter((plugin) => {
      if (plugin) {
        return plugin.name === 'DefinePlugin'
      } else {
        return false
      }
    })

    expect(maybeDefinePluginInstance).toHaveLength(1)
    const defineInstance = maybeDefinePluginInstance![0]

    expect(defineInstance!).toMatchObject(
      expect.objectContaining({
        _args: [expect.objectContaining({ 'process.env.PUBLIC_FOO': '"BAR"' })],
      }),
    )
  })
})
