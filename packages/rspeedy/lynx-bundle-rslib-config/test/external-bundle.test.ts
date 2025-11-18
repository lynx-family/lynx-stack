// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from '@rslib/core'
import { describe, expect, it, vi } from 'vitest'

import { decodeTemplate } from './utils.js'
import { LAYERS, defineExternalBundleRslibConfig } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('define config', () => {
  it('should return entry config', () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
    })
    expect(rslibConfig.lib[0]?.source).toMatchObject({
      entry: {
        utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
      },
    })
  })

  it('should override default lib config', () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      syntax: 'es2019',
    })
    expect(rslibConfig.lib[0]?.syntax).toBe('es2019')
  })
})

describe('should build external bundle', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  it('should build both main-thread and background code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-dual',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-dual.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toEqual([
      'utils',
      'utils__main-thread',
    ])
  })

  it('should only build main-thread code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: {
            import: path.join(__dirname, './fixtures/utils-lib/index.ts'),
            layer: LAYERS.MAIN_THREAD,
          },
        },
      },
      id: 'utils-m',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-m.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toEqual([
      'utils',
    ])
    expect(decodedResult['custom-sections']['utils']?.includes('.define('))
      .toBeFalsy()
  })

  it('should only build background code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: {
            import: path.join(__dirname, './fixtures/utils-lib/index.ts'),
            layer: LAYERS.BACKGROUND,
          },
        },
      },
      id: 'utils-b',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-b.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toEqual([
      'utils',
    ])
    expect(decodedResult['custom-sections']['utils']?.includes('.define('))
      .toBeTruthy()
  })

  it('set targetSdkVersion to 3.5', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-targetSdkVersion-35',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
    }, {
      targetSdkVersion: '3.5',
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-targetSdkVersion-35.lynx.bundle'),
    )
    expect(decodedResult['engine-version']).toBe('3.5')
  })

  it('override the default syntax to es2023', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-es2023',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
        minify: false,
      },
      syntax: 'es2023',
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-es2023.lynx.bundle'),
    )
    expect(
      decodedResult['custom-sections']['utils']?.includes('globalThis?.abc'),
    )
      .toBeTruthy()
  })
})

describe('debug mode artifacts', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'lib')

  const bundleId = 'utils-debug-flag'

  const getFiles = () =>
    fs.existsSync(distRoot)
      ? fs.readdirSync(distRoot)
      : []

  const buildBundle = () => {
    return build(defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: bundleId,
      output: {
        distPath: {
          root: distRoot,
        },
      },
    }))
  }

  it('does not emit template intermediates when DEBUG is unset', async () => {
    vi.stubEnv('DEBUG', undefined)

    await buildBundle()
    expect(getFiles()).not.toContain('tasm.json')

    vi.unstubAllEnvs()
  })

  it('emits template intermediates when DEBUG is set', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')

    await buildBundle()
    expect(getFiles()).toEqual(
      expect.arrayContaining(['tasm.json']),
    )

    vi.unstubAllEnvs()
  })
})
