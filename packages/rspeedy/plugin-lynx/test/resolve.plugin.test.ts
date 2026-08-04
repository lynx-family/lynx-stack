// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { pluginLynx } from '../src/index.js'

describe('pluginResolve', () => {
  test('should apply the Lynx resolve options', async () => {
    const rsbuild = await createRsbuild({
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [pluginLynx()],
      },
    })
    const [config] = await rsbuild.initConfigs()

    expect(config?.resolve?.aliasFields).toContain('browser')
    expect(config?.resolve?.conditionNames).toEqual([
      'lynx',
      'import',
      'require',
      'browser',
    ])
    expect(config?.resolve?.extensions).toContain('.cjs')
    expect(config?.resolve?.mainFields).toEqual(['lynx', 'module', 'main'])
    expect(config?.resolve?.mainFiles).toEqual(['index.lynx', 'index'])
  })
})
