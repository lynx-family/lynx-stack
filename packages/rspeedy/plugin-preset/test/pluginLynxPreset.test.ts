// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { Rspack } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import type { Config } from '../src/config/index.js'
import { pluginLynxPreset } from '../src/index.js'

const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

async function unwrapConfig(config?: Config): Promise<Rspack.Configuration> {
  const rsbuild = await createRsbuild({
    cwd,
    rsbuildConfig: {
      plugins: [pluginLynxPreset(config)],
      environments: { lynx: {} },
    },
  })
  const [rspackConfig] = await rsbuild.initConfigs()
  return rspackConfig!
}

describe('pluginLynxPreset', () => {
  test('applies the Lynx default entry with no config', async () => {
    const config = await unwrapConfig()
    // `applyDefaultRspeedyConfig` + `toRsbuildEntry(undefined)` default the
    // entry to `main`.
    expect(Object.keys(config.entry ?? {})).toContain('main')
  })

  test('threads `resolve.alias` from the passed Lynx config', async () => {
    const config = await unwrapConfig({
      resolve: { alias: { '@lynx-preset-test': './src/marker' } },
    })
    expect(config.resolve?.alias).toHaveProperty('@lynx-preset-test')
  })

  test('threads `source.entry` from the passed Lynx config', async () => {
    const config = await unwrapConfig({
      source: { entry: { custom: './src/custom.tsx' } },
    })
    expect(Object.keys(config.entry ?? {})).toContain('custom')
  })

  test('threads `source.define` into the DefinePlugin', async () => {
    const config = await unwrapConfig({
      source: { define: { __LYNX_PRESET_TEST__: JSON.stringify('yes') } },
    })
    const hasDefine = JSON.stringify(config.plugins).includes(
      '__LYNX_PRESET_TEST__',
    )
    expect(hasDefine).toBe(true)
  })
})
