// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { pluginLynx } from '../src/index.js'

describe('pluginLynx', () => {
  test('should compose into an Rsbuild instance', async () => {
    const rsbuild = await createRsbuild({
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [pluginLynx()],
      },
    })

    await expect(rsbuild.initConfigs()).resolves.toBeDefined()
  })
})
