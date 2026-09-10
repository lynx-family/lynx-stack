// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core'

import { pluginRsdoctor } from '../../src/plugins/rsdoctor.plugin.js'

const { createPlugin } = rstest.hoisted(() => ({ createPlugin: rstest.fn() }))
rstest.mock('@rsdoctor/core', () => ({
  RsdoctorRspackPlugin: class {
    readonly isRsdoctorPlugin = true
    constructor(options: unknown) {
      createPlugin(options)
    }
  },
}))

async function register(configs: Rspack.Configuration[]) {
  const onBeforeCreateCompiler = rstest.fn<
    (
      callback: (
        args: { bundlerConfigs: Rspack.Configuration[] },
      ) => Promise<void>,
    ) => void
  >()
  await pluginRsdoctor().setup(
    { onBeforeCreateCompiler } as unknown as RsbuildPluginAPI,
  )
  await onBeforeCreateCompiler.mock.calls[0]?.[0]({ bundlerConfigs: configs })
}

beforeEach(() => {
  rstest.stubEnv('RSDOCTOR', 'true')
  createPlugin.mockReset()
})
afterEach(() => {
  rstest.unstubAllGlobals()
  rstest.unstubAllEnvs()
})

describe('Rsdoctor 2 registration', () => {
  test('does not register when analysis is disabled', async () => {
    rstest.stubEnv('RSDOCTOR', 'false')
    await register([{}])
    expect(createPlugin).not.toHaveBeenCalled()
  })

  test.each(['20.19.0', '22.12.0', '22.18.0', '24.0.0'])(
    'auto-registers on Node %s',
    async node => {
      rstest.stubGlobal('process', {
        ...process,
        versions: { ...process.versions, node },
      })
      const config: Rspack.Configuration = {}
      await register([config])
      expect(config.plugins).toHaveLength(1)
      expect(createPlugin).toHaveBeenCalledTimes(1)
    },
  )

  test('only fills missing configs in a multi-compiler build', async () => {
    const plugin = { isRsdoctorPlugin: true, apply: rstest.fn() }
    const custom = { plugins: [plugin] }
    const pending: Rspack.Configuration = {}
    await register([custom, pending])
    expect(custom.plugins).toEqual([plugin])
    expect(pending.plugins).toHaveLength(1)
    expect(createPlugin).toHaveBeenCalledTimes(1)
  })

  test('does not construct another plugin when all configs already have one', async () => {
    const plugin = { isRsdoctorPlugin: true, apply: rstest.fn() }
    await register([{ plugins: [plugin] }, { plugins: [plugin] }])
    expect(createPlugin).not.toHaveBeenCalled()
  })

  test('preserves plugin initialization errors', async () => {
    const error = new Error('invalid plugin options')
    createPlugin.mockImplementation(() => {
      throw error
    })
    await expect(register([{}])).rejects.toBe(error)
  })
})
