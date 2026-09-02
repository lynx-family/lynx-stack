// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildConfig, Rspack } from '@rsbuild/core'
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

async function configForRslib(output: RsbuildConfig['output'] = {}) {
  const rsbuild = await createRsbuild({
    callerName: 'rslib',
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      mode: 'production',
      environments: { lynx: {} },
      output,
      plugins: [pluginLynx()],
    },
  })

  const [config] = await rsbuild.initConfigs()
  return config
}

describe('pluginLynx with a caller that assembles its own bundle', () => {
  test('lowers to the ES baseline the Lynx runtime parses', async () => {
    const config = await configForRslib()

    expect(config?.target).toContain('es2017')
    expect(swcEnvIncludes(config)).toContain('transform-block-scoping')
  })

  test('minifies the CSS it encodes', async () => {
    const config = await configForRslib()

    expect(
      (config?.optimization?.minimizer ?? []).map(minimizer =>
        (minimizer as { constructor?: { name?: string } })?.constructor?.name
      ),
    ).toContain('CssMinimizerPlugin')
  })

  test('emits the source maps the debug metadata is collected from', async () => {
    const config = await configForRslib({ sourceMap: true })

    expect(pluginNames(config)).toContain('SourceMapDevToolPlugin')
    expect(pluginNames(config)).toContain('DropSourceMapAssetsPlugin')
  })
})

function pluginNames(config: Rspack.Configuration | undefined): string[] {
  return (config?.plugins ?? []).map(plugin => plugin?.constructor.name ?? '')
}
