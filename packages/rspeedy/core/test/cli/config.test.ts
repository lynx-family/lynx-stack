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

  test('createRspeedy with env-mode ', async () => {
    const root = join(fixturesRoot, 'project-with-env')
    const rsbuild = await createRspeedy({
      cwd: root,
      loadEnv: {
        mode: 'test',
      },
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
        _args: [
          expect.objectContaining({
            'process.env.PUBLIC_FOO': '"BAR"',
            'process.env.PUBLIC_TEST': '"TEST"',
          }),
        ],
      }),
    )
  })

  test('createRspeedy with no-env ', async () => {
    const root = join(fixturesRoot, 'project-with-env')
    const rsbuild = await createRspeedy({
      cwd: root,
      loadEnv: false,
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
        _args: [
          expect.not.objectContaining({
            'process.env.PUBLIC_FOO': '"BAR"',
            'process.env.PUBLIC_TEST': '"TEST"',
          }),
        ],
      }),
    )
  })
})

describe('rspeedy environment test', () => {
  const fixturesRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
  )

  test.each([
    { name: 'web only', environment: ['web'], expected: ['web'] },
    { name: 'lynx only', environment: ['lynx'], expected: ['lynx'] },
    {
      name: 'web + lynx',
      environment: ['web', 'lynx'],
      expected: ['web', 'lynx'],
    },
    { name: 'empty array', environment: [], expected: ['web', 'lynx'] },
  ])(
    'test environment combinations - $name',
    async ({ environment, expected }) => {
      const root = join(fixturesRoot, 'environment')
      const rsbuild = await createRspeedy({
        cwd: root,
        rspeedyConfig: {
          environments: {
            web: {},
            lynx: {},
          },
        },
        environment,
      })
      const configs = await rsbuild.initConfigs()
      expect(configs).toHaveLength(expected.length)
      expect(configs.map(c => c.name)).toEqual(expected)
    },
  )
})
