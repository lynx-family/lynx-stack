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

function swcEnvIncludes(config: unknown): string[] {
  const includes: string[] = []
  JSON.stringify(config, (key: string, value: unknown) => {
    if (key === 'env' && value !== null && typeof value === 'object') {
      const { include } = value as { include?: unknown }
      if (Array.isArray(include)) {
        includes.push(...include.map(String))
      }
    }
    return value
  })
  return includes
}

async function configForRslib() {
  const rsbuild = await createRsbuild({
    callerName: 'rslib',
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      mode: 'production',
      environments: { lynx: {} },
      plugins: [pluginLynx()],
    },
  })

  const [config] = await rsbuild.initConfigs()
  return config
}

describe('pluginLynx with a caller that assembles its own bundle', () => {
  test('resolves a module the way the Lynx runtime needs', async () => {
    const config = await configForRslib()

    expect(config?.resolve?.conditionNames).toContain('lynx')
    expect(config?.resolve?.mainFields).toContain('lynx')
    expect(config?.resolve?.mainFiles).toContain('index.lynx')
  })

  test('lowers to the ES baseline the Lynx runtime parses', async () => {
    const config = await configForRslib()

    expect(config?.target).toContain('es2017')
    expect(swcEnvIncludes(config)).toContain('transform-block-scoping')
  })

  test('emits what a Lynx bundle can carry', async () => {
    const config = await configForRslib()

    // Lynx has no HTML, and a bundle has nowhere to link a license file to.
    expect(
      config?.plugins?.some(plugin =>
        plugin?.constructor.name.includes('Html')
      ),
    ).toBe(false)
    expect(config?.output?.environment?.const).toBe(false)
  })

  test('leaves the bundle assembly to the caller', async () => {
    const config = await configForRslib()

    expect(config?.output?.chunkLoading).toBeUndefined()
  })
})
