// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { pluginLynx } from '../src/index.js'

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: Pick<
    typeof LynxTemplatePlugin,
    'getLynxTemplatePluginHooks'
  >
}

describe('pluginTemplate', () => {
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
