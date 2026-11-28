// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin'

import { pluginLynx } from '../src/index.js'

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: Pick<
    typeof LynxTemplatePlugin,
    'getLynxTemplatePluginHooks'
  >
}

describe('pluginTemplate', () => {
  test.each([false, true])(
    'configures one encoder for a resource with existing encoder=%s',
    async existing => {
      const rsbuild = await createRsbuild({
        rsbuildConfig: {
          environments: { lynx: {} },
          plugins: [
            pluginLynx(),
            {
              name: 'test:resource-template',
              setup(api: RsbuildPluginAPI) {
                api.modifyBundlerChain(chain => {
                  chain.plugin('test:resource-template').use(
                    LynxTemplatePlugin,
                    [{
                      ...LynxTemplatePlugin.defaultOptions,
                      filename: 'resource.lynx.bundle',
                      chunks: [],
                      targetSdkVersion: '3.7',
                    }],
                  )
                  if (existing) {
                    chain.plugin('LynxEncodePlugin').use(LynxEncodePlugin, [{
                      inlineScripts: false,
                    }])
                  }
                })
                api.modifyRspackConfig(config => {
                  config.entry ??= {}
                })
              },
            },
          ],
        },
      })
      const [config] = await rsbuild.initConfigs()
      const encoders = config?.plugins?.filter(plugin =>
        plugin?.constructor.name === 'LynxEncodePlugin'
      )
      expect(encoders).toHaveLength(1)
      expect(
        config?.plugins?.filter(plugin =>
          plugin?.constructor.name === 'RuntimeWrapperWebpackPlugin'
        ),
      ).toHaveLength(0)
      if (existing) {
        // The resource fallback must not replace an encoder registered by a DSL.
        expect(encoders?.[0]).toHaveProperty('options', {
          inlineScripts: false,
        })
      }
    },
  )

  test('keeps the native Rslib fallback for web-prefixed environments', async () => {
    const rsbuild = await createRsbuild({
      callerName: 'rslib',
      rsbuildConfig: {
        environments: { 'web-preview': {} },
        source: { entry: { main: './main.ts' } },
        plugins: [pluginLynx()],
      },
    })
    const [config] = await rsbuild.initConfigs()
    const names = config?.plugins?.map(plugin => plugin?.constructor.name)
    expect(names).toContain('LynxEncodePlugin')
    expect(names).not.toContain('LynxTemplatePlugin')
    expect(
      config?.plugins?.find(plugin =>
        plugin?.constructor.name === 'RuntimeWrapperWebpackPlugin'
      ),
    ).toHaveProperty('options', {})
  })

  test('exposes LynxTemplatePlugin without a DSL plugin', async () => {
    let exposed: LynxTemplatePluginExposure | undefined

    const rsbuild = await createRsbuild({
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [
          ...pluginLynx(),
          {
            name: 'test:capture',
            setup(api: RsbuildPluginAPI) {
              api.modifyBundlerChain(() => {
                exposed = api.useExposed<LynxTemplatePluginExposure>(
                  Symbol.for('LynxTemplatePlugin'),
                )
              })
            },
          },
        ],
      },
    })

    await rsbuild.initConfigs()

    expect(typeof exposed?.LynxTemplatePlugin.getLynxTemplatePluginHooks)
      .toBe('function')
  })
})
