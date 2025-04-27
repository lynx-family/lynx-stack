// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  TEST_ONLY_hasNativeTSSupport as hasNativeTSSupport,
  loadConfig,
} from '../../src/config/loadConfig.js'
import type { Config } from '../../src/index.js'

describe('Config - loadConfig', () => {
  test('load with default lynx.config.ts', async () => {
    const cwd = join(__dirname, 'fixtures', 'default')
    const actual = await loadConfig({ cwd })
    const expected = await import(join(cwd, 'lynx.config.ts')) as {
      default: Config
    }
    expect(actual.content).toStrictEqual(expected.default)
  })

  test('load with the correct order', async () => {
    const cwd = join(__dirname, 'fixtures', 'order')
    const actual = await loadConfig({ cwd })
    const expected = await import(join(cwd, 'lynx.config.ts')) as {
      default: Config
    }
    expect(actual.content).toStrictEqual(expected.default)
  })

  test('load with custom relative config', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({ cwd, configPath: './custom.config.js' })
    const expected = await import(join(cwd, 'custom.config.js')) as {
      default: Config
    }
    expect(actual.content).toStrictEqual(expected.default)
  })

  test('load with custom absolute config', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({
      cwd,
      configPath: join(cwd, 'custom.config.js'),
    })
    const expected = await import(join(cwd, 'custom.config.js')) as {
      default: Config
    }
    expect(actual.content).toStrictEqual(expected.default)
  })

  test('load with custom relative cjs config', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({ cwd, configPath: './custom.config.cjs' })
    const expected = await import(join(cwd, 'custom.config.cjs')) as {
      default: Config
    }
    expect(actual.content).toStrictEqual(expected.default)
  })

  test('load with custom relative commonjs typescript config', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({
      cwd,
      configPath: './custom-cts.config.ts',
    })
    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "custom-cts",
        },
      }
    `)
  })

  test('load with mts extension', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({
      cwd,
      configPath: './custom.mts',
    })
    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "custom-mts",
        },
      }
    `)
  })

  test('load with cts extension', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')
    const actual = await loadConfig({
      cwd,
      configPath: './custom.cts',
    })
    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "custom-cts",
        },
      }
    `)
  })

  test('load with "type": "commonjs" in package.json', async () => {
    const cwd = join(__dirname, 'fixtures', 'cjs')
    const actual = await loadConfig({
      cwd,
      configPath: './lynx.config.js',
    })
    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "cjs-default",
        },
      }
    `)

    const actualMts = await loadConfig({
      cwd,
      configPath: './lynx.config.mts',
    })
    expect(actualMts.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "cjs-mts",
        },
      }
    `)
  })

  test('load config with no "type" in package.json and mjs extension', async () => {
    const cwd = join(__dirname, 'fixtures', 'cjs', 'default')

    const actual = await loadConfig({
      cwd,
      configPath: './config.mjs',
    })

    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "package-mjs",
        },
      }
    `)
  })

  test('load config with no package.json found with mjs extension', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'rspeedy-test'))

    await writeFile(
      join(cwd, 'config.mjs'),
      `export default { source: { entry: 'tmp-mjs' } }`,
    )

    const actual = await loadConfig({
      cwd,
      configPath: './config.mjs',
    })

    expect(actual.content).toMatchInlineSnapshot(`
      {
        "source": {
          "entry": "tmp-mjs",
        },
      }
    `)
  })

  test('load with "type": "commonjs" in package.json and export default', async () => {
    const cwd = join(__dirname, 'fixtures', 'cjs')

    const actual = await loadConfig({
      cwd,
      configPath: './export-default.ts',
    })

    expect(actual.content).toStrictEqual(expect.objectContaining({
      source: {
        entry: 'cjs-export-default',
      },
    }))
  })

  test('load with "type": "commonjs" in package.json and esm pkg', async () => {
    const cwd = join(__dirname, 'fixtures', 'cjs')

    const actual = await loadConfig({
      cwd,
      configPath: './esm-import-esm.js',
    })

    expect(actual.content).toStrictEqual(expect.objectContaining({
      source: {
        entry: 'esm-import-esm',
      },
    }))
  })

  test('load config with enum', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')

    const actual = await loadConfig({
      cwd,
      configPath: './enum.ts',
    })

    expect(actual.content).toStrictEqual(expect.objectContaining({
      source: {
        define: {
          bar: 0,
          baz: 1,
        },
        entry: 'custom-enum',
      },
    }))
  })

  test('load config with const enum', async () => {
    const cwd = join(__dirname, 'fixtures', 'custom')

    const actual = await loadConfig({
      cwd,
      configPath: './const-enum.ts',
    })

    expect(actual.content).toStrictEqual(expect.objectContaining({
      source: {
        define: {
          bar: 0,
          baz: 1,
        },
        entry: 'custom-const-enum',
      },
    }))
  })

  describe('Error Cases', () => {
    test('load non-exists custom config', async () => {
      const actual = loadConfig({ configPath: 'non-exist-config.js' })

      await expect(actual).rejects.toThrowError(
        /Cannot find config file: (.*)non-exist-config.js/,
      )
    })

    test('load non-exists default config', async () => {
      await expect(() => loadConfig({ cwd: 'non-exist-path' })).rejects
        .toThrowError(
          `Cannot find the default config file: non-exist-path/lynx.config.ts. Use custom config with \`--config <config>\` options.`,
        )
    })

    test('invalid JavaScript', async () => {
      const cwd = join(__dirname, 'fixtures', 'error')

      const actual = loadConfig({ cwd, configPath: './invalid.js' })

      await expect(actual).rejects.toHaveProperty(
        'message',
      )
    })

    test('throw error', async () => {
      const cwd = join(__dirname, 'fixtures', 'error')

      await expect(() =>
        loadConfig({
          cwd,
          configPath: './throw.js',
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(`1`)
    })

    test('load config with no "type" in package.json', async () => {
      const cwd = join(__dirname, 'fixtures', 'cjs', 'default')

      await expect(() =>
        loadConfig({
          cwd,
          configPath: './config.js',
        })
      ).rejects.toThrowError(
        `Unknown property: \`$input["default"]\` in configuration`,
      )
    })

    test('load config with no package.json found', async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'rspeedy-test'))

      await writeFile(
        join(cwd, 'config.js'),
        `module.exports = { default: {} }`,
      )

      await expect(() =>
        loadConfig({
          cwd,
          configPath: './config.js',
        })
      ).rejects.toThrowError(
        `Unknown property: \`$input["default"]\` in configuration`,
      )
    })
  })
})

describe('hasNativeTSSupport', () => {
  const process: {
    env: Record<string, string>
    features: { typescript?: false | 'strip' | 'transform' | undefined }
  } = {
    env: {},
    features: {},
  }

  beforeEach(() => {
    process.env = {}
    process.features = {}
    vi.stubGlobal('process', process)

    return () => {
      vi.unstubAllGlobals()
    }
  })

  test('without features.typescript', () => {
    expect(hasNativeTSSupport()).toBe(false)
  })

  test('with features.typescript: "transform"', () => {
    process.features.typescript = 'transform'
    expect(hasNativeTSSupport()).toBe(true)
  })

  test('with features.typescript: "strip"', () => {
    process.features.typescript = 'strip'
    expect(hasNativeTSSupport()).toBe(true)
  })

  test('with features.typescript: false', () => {
    process.features.typescript = false
    expect(hasNativeTSSupport()).toBe(false)
  })

  test('with features.typescript: undefined', () => {
    process.features.typescript = undefined
    expect(hasNativeTSSupport()).toBe(false)
  })

  test('with NODE_OPTIONS: --experimental-transform-types', () => {
    process.env['NODE_OPTIONS'] = '--experimental-transform-types'
    expect(hasNativeTSSupport()).toBe(true)
  })

  test('with NODE_OPTIONS: --experimental-strip-types', () => {
    process.env['NODE_OPTIONS'] = '--experimental-strip-types'
    expect(hasNativeTSSupport()).toBe(true)
  })
})
