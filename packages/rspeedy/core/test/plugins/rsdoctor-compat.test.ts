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

const { resolve, pluginState } = rstest.hoisted(() => ({
  resolve: rstest.fn(),
  pluginState: { available: true },
}))
rstest.mock('node:module', () => ({ createRequire: () => ({ resolve }) }))
rstest.mock('@rsdoctor/core', () => ({
  get RsdoctorRspackPlugin() {
    if (!pluginState.available) return undefined
    return class {
      readonly isRsdoctorPlugin = true
      constructor(readonly options: unknown) {}
    }
  },
}))

function useNode(node: string) {
  rstest.stubGlobal('process', {
    ...process,
    versions: { ...process.versions, node },
  })
}

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

function customPlugin() {
  return { isRsdoctorPlugin: true, apply: rstest.fn() }
}

beforeEach(() => {
  rstest.stubEnv('RSDOCTOR', 'true')
  pluginState.available = true
  resolve.mockReset().mockReturnValue('/optional/rsdoctor.js')
})
afterEach(() => {
  rstest.unstubAllGlobals()
  rstest.unstubAllEnvs()
})

describe('optional Rsdoctor compatibility', () => {
  test('does not resolve the plugin when analysis is disabled', async () => {
    useNode('20.19.0')
    rstest.stubEnv('RSDOCTOR', 'false')
    await register([{}])
    expect(resolve).not.toHaveBeenCalled()
  })

  test.each(['20.19.0', '22.12.0', '22.17.1'])(
    'guides Node %s users to manual v1 registration',
    async node => {
      useNode(node)
      await expect(register([{}])).rejects.toThrow(
        'install @rsdoctor/rspack-plugin@1',
      )
      expect(resolve).not.toHaveBeenCalled()
    },
  )

  test.each(['22.18.0', '24.0.0'])('auto-registers on Node %s', async node => {
    useNode(node)
    const config: Rspack.Configuration = {}
    await register([config])
    expect(config.plugins).toHaveLength(1)
    expect(resolve).toHaveBeenCalledWith('@rsdoctor/core')
  })

  test('preserves manually registered plugins on Node 20 without resolving v2', async () => {
    useNode('20.19.0')
    const plugin = customPlugin()
    const configs = [{ plugins: [plugin] }, { plugins: [plugin] }]
    await register(configs)
    expect(configs.every(config => config.plugins.length === 1)).toBe(true)
    expect(resolve).not.toHaveBeenCalled()
  })

  test('only fills missing configs in a multi-compiler build', async () => {
    useNode('22.18.0')
    const custom = { plugins: [customPlugin()] }
    const pending: Rspack.Configuration = {}
    await register([custom, pending])
    expect(custom.plugins).toHaveLength(1)
    expect(pending.plugins).toHaveLength(1)
  })

  test('does not silently skip an unconfigured compiler on Node 20', async () => {
    useNode('20.19.0')
    await expect(register([{ plugins: [customPlugin()] }, {}])).rejects.toThrow(
      'requires Node.js >=22.18',
    )
  })

  test('explains how to install the missing optional dependency', async () => {
    useNode('22.18.0')
    resolve.mockImplementation(() => {
      throw Object.assign(new Error('missing'), { code: 'MODULE_NOT_FOUND' })
    })
    await expect(register([{}])).rejects.toThrow(
      'Install @rsdoctor/core@2.0.0-beta.1',
    )
  })

  test('guides users when resolution finds core v1 without the plugin export', async () => {
    useNode('22.18.0')
    pluginState.available = false
    await expect(register([{}])).rejects.toThrow(
      'Install @rsdoctor/core@2.0.0-beta.1',
    )
  })

  test('preserves other resolution errors', async () => {
    useNode('22.18.0')
    const error = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    })
    resolve.mockImplementation(() => {
      throw error
    })
    await expect(register([{}])).rejects.toBe(error)
  })
})
