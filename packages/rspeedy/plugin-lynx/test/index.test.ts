// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild, logger } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, rs, test } from '@rstest/core'

import { pluginLynx } from '../src/index.js'
import type { ExposedConfig } from '../src/plugin-api.js'
import { version } from '../src/version.js'

interface ExposedAPI {
  config: ExposedConfig
  debug: (message: string | (() => string)) => void
  exit: () => void
  logger: typeof logger
  version: string
}

async function init(rsbuildConfig: RsbuildConfig = {}) {
  const rsbuild = await createRsbuild({
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      environments: { lynx: {} },
      ...rsbuildConfig,
      plugins: [pluginLynx(), ...(rsbuildConfig.plugins ?? [])],
    },
  })
  await rsbuild.initConfigs()
  return rsbuild
}

describe('pluginLynx', () => {
  test('should apply the Lynx build defaults', async () => {
    const rsbuild = await init()
    const config = rsbuild.getNormalizedConfig()

    expect(config.dev.writeToDisk).toBe(true)
    expect(config.dev.progressBar).toBe(true)
    expect(config.dev.lazyCompilation).toBe(false)
    expect(config.server.host).toBe('0.0.0.0')
    expect(config.output.legalComments).toBe('none')
    expect(config.output.inlineScripts).toBe(true)
    expect(config.output.charset).toBe('utf8')
    expect(config.output.polyfill).toBe('off')
    expect(config.output.cssModules.localIdentName).toBe(
      '[local]-[hash:base64:6]',
    )
    expect(config.tools.htmlPlugin).toBe(false)
  })

  test('should keep user-set fields', async () => {
    const rsbuild = await init({
      dev: { writeToDisk: false },
      server: { host: 'localhost' },
      output: { legalComments: 'inline', sourceMap: { js: 'source-map' } },
    })
    const config = rsbuild.getNormalizedConfig()

    expect(config.dev.writeToDisk).toBe(false)
    expect(config.server.host).toBe('localhost')
    expect(config.output.legalComments).toBe('inline')
    expect(config.output.sourceMap).toMatchObject({ js: 'source-map' })
  })

  test('should force Lynx-incompatible fields and warn', async () => {
    const warn = rs.spyOn(logger, 'warn').mockImplementation(() => void 0)

    try {
      const rsbuild = await init({
        output: { polyfill: 'usage' },
        tools: { htmlPlugin: {} },
      })
      const config = rsbuild.getNormalizedConfig()

      expect(config.output.polyfill).toBe('off')
      expect(config.tools.htmlPlugin).toBe(false)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('`tools.htmlPlugin` is forced to `false`'),
      )
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('`output.polyfill` is forced to `"off"`'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  test('should expose the Lynx API under both symbols', async () => {
    let lynxAPI: ExposedAPI | undefined
    let rspeedyAPI: ExposedAPI | undefined
    const probe: RsbuildPlugin = {
      name: 'test:probe',
      setup(api) {
        lynxAPI = api.useExposed<ExposedAPI>(Symbol.for('lynx.api'))
        rspeedyAPI = api.useExposed<ExposedAPI>(Symbol.for('rspeedy.api'))
      },
    }
    await init({ plugins: [probe] })

    expect(lynxAPI).toBeDefined()
    expect(rspeedyAPI).toBe(lynxAPI)
    expect(lynxAPI?.config.output?.filename).toEqual({
      bundle: '[name].[platform].bundle',
      template: '[name].[platform].bundle',
    })
    expect(lynxAPI?.version).toBe(version)
    expect(lynxAPI?.exit()).toBeUndefined()
    expect(() => {
      lynxAPI?.debug('message')
      lynxAPI?.debug(() => 'lazy message')
    }).not.toThrow()
  })
})
